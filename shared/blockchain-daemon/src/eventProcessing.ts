import mongoose, { Schema } from 'mongoose';
import type { Model } from 'mongoose';

/**
 * Exactly-once processing of blockchain events.
 *
 * The transport only guarantees "at-least-once": a message can be delivered
 * again (lost ack, consumer restart, scanner re-publish, daemon retries...).
 * To get "exactly-once" processing, every event is applied inside a single
 * Mongo transaction together with a unique processed-events marker:
 *
 *   1. insert the marker (chainId + transactionHash + logIndex, unique index);
 *   2. run the handler - every DB operation inside joins the transaction;
 *   3. commit; only then acknowledge the message.
 *
 * - duplicate delivery -> the marker insert fails -> the transaction rolls
 *   back -> nothing is applied and the message is acknowledged as a duplicate;
 * - crash/failure anywhere before commit -> everything rolls back -> the
 *   redelivered message starts from a clean slate.
 *
 * Requires MongoDB to run as a replica set (multi-document transactions).
 */

// Mongoose >= 8.4: propagate the transaction session to every operation
// executed inside `connection.transaction(...)` via AsyncLocalStorage, so the
// repositories never have to pass a session around manually.
mongoose.set('transactionAsyncLocalStorage', true);

const PROCESSED_EVENT_MODEL_NAME = 'ProcessedEvent';

const processedEventSchema = new Schema(
  {
    chainId: { type: Number, required: true },
    transactionHash: { type: String, required: true },
    logIndex: { type: Number, required: true },
    name: { type: String },
    processedAt: { type: Date, default: () => new Date() },
  },
  { collection: 'processed_events', versionKey: false },
);

// The unique index is what rejects duplicate deliveries.
processedEventSchema.index({ chainId: 1, transactionHash: 1, logIndex: 1 }, { unique: true });

/** Bound to the service's default mongoose connection. */
function getProcessedEventModel(): Model<any> {
  return (
    (mongoose.models[PROCESSED_EVENT_MODEL_NAME] as Model<any>) ??
    mongoose.model(PROCESSED_EVENT_MODEL_NAME, processedEventSchema)
  );
}

export interface ProcessableEvent {
  chainId: number;
  transactionHash: string;
  logIndex: number;
  name?: string;
}

/** All errors in the `cause` chain (services wrap low-level errors). */
function errorChain(error: unknown): Array<Record<string, any>> {
  const chain: Array<Record<string, any>> = [];
  let current = error as Record<string, any> | null | undefined;
  for (let i = 0; i < 10 && current; i++) {
    chain.push(current);
    current = current.cause as Record<string, any> | undefined;
  }
  return chain;
}

/** True when a unique index rejected the write (Mongo duplicate key). */
export function isDuplicateKeyError(error: unknown): boolean {
  return errorChain(error).some((e) => e.code === 11000);
}

/**
 * True when the rejected index was an event-dedup key
 * (transactionHash/txHash + logIndex), i.e. this event was already processed.
 */
export function isEventDuplicateKeyError(error: unknown): boolean {
  return errorChain(error).some((e) => {
    if (e.code !== 11000) return false;
    const keyValue = (e.keyValue ?? {}) as Record<string, unknown>;
    const hasTransaction = typeof keyValue.transactionHash === 'string' || typeof keyValue.txHash === 'string';
    return hasTransaction && keyValue.logIndex !== undefined;
  });
}

const TRANSIENT_ERROR_NAMES = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoExpiredSessionError',
  'MongoPoolClosedError',
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /buffering timed out/i,
  /replica set member or mongos/i, // transactions attempted on a standalone deployment
  /server selection timed out/i,
  /topology is closed/i,
  /client must be connected/i,
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up|connection .* closed/i,
];

/**
 * Infrastructure failures that resolve by themselves (database temporarily
 * unavailable, connection reset, replica set still booting). Such errors must
 * never push a message into the manual-review queue.
 */
export function isTransientDbError(error: unknown): boolean {
  return errorChain(error).some((e) => {
    const name = typeof e.name === 'string' ? e.name : '';
    const message = typeof e.message === 'string' ? e.message : '';
    return TRANSIENT_ERROR_NAMES.has(name) || TRANSIENT_MESSAGE_PATTERNS.some((p) => p.test(message));
  });
}

/**
 * Applies `handler` exactly once for the given event.
 *
 * Returns `true` when the event was applied by this call, `false` when it had
 * already been processed earlier (a duplicate delivery: nothing changed).
 * Throws on real failures - in that case the marker and every partial write
 * are rolled back, so a retry starts from a clean slate.
 */
export async function processEventExactlyOnce(
  event: ProcessableEvent,
  handler: () => Promise<void>,
): Promise<boolean> {
  try {
    await mongoose.connection.transaction(async () => {
      await getProcessedEventModel().create({
        chainId: event.chainId,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        name: event.name,
      });

      await handler();
    });

    return true;
  } catch (error) {
    if (isEventDuplicateKeyError(error)) {
      return false;
    }
    throw error;
  }
}

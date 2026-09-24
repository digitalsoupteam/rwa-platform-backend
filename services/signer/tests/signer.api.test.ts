/**
 * Component tests for the signer HTTP layer — intentionally skipped.
 *
 * The signer service exposes no HTTP endpoints of its own: src/ has no
 * controllers plugin (there is no controllers.plugin.ts and no routes), and the
 * service's only entry point is the RabbitMQ consumer registered by
 * SignatureDaemon. The single route reachable through createApp() is
 * GET /health, which comes from the shared healthPlugin (@shared/monitoring)
 * and holds no signer logic; createApp() itself cannot be assembled in-process
 * because createClientsPlugin() connects to RabbitMQ.
 *
 * The daemon-level component coverage — fake signers-manager client + real
 * SignatureService, synthetic amqplib deliveries, sign/ack/nack round-trips —
 * lives in signature.daemon.test.ts.
 */
import { test } from 'bun:test';

test.skip('signer exposes no HTTP endpoints; covered at the daemon level instead', () => {
  // Nothing to request here: see the file header and signature.daemon.test.ts.
});

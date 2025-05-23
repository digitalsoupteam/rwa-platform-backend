import { t } from "elysia";

export const poolTransactionSchema = t.Object({
  id: t.String(),
  poolAddress: t.String(),
  transactionType: t.Union([t.Literal('MINT'), t.Literal('BURN')]),
  userAddress: t.String(),
  timestamp: t.Number(),
  rwaAmount: t.String(),
  holdAmount: t.String(),
  bonusAmount: t.String(),
  holdFee: t.String(),
  bonusFee: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number()
});

export const getPoolTransactionsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});

export const getPoolTransactionsResponse = t.Array(poolTransactionSchema);

export const getVolumeDataRequest = t.Object({
  poolAddress: t.String(),
  interval: t.Union([
    t.Literal("1m"),
    t.Literal("5m"),
    t.Literal("15m"),
    t.Literal("30m"),
    t.Literal("1h"),
    t.Literal("2h"),
    t.Literal("4h"),
    t.Literal("6h"),
    t.Literal("12h"),
    t.Literal("1d"),
    t.Literal("1w")
  ]),
  startTime: t.Number(),
  endTime: t.Number(),
  limit: t.Optional(t.Number())
});

export const getVolumeDataResponse = t.Array(t.Object({
  timestamp: t.Number(),
  mintVolume: t.String(),
  burnVolume: t.String()
}));
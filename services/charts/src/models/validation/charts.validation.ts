import { t } from "elysia";


export const priceDataSchema = t.Object({
  id: t.String(),
  poolAddress: t.String(),
  timestamp: t.Number(),
  blockNumber: t.Number(),
  realHoldReserve: t.String(),
  virtualHoldReserve: t.String(),
  virtualRwaReserve: t.String(),
  price: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number()
});


export const ohlcDataSchema = t.Object({
  timestamp: t.Number(),
  open: t.String(),
  high: t.String(),
  low: t.String(),
  close: t.String()
});


export const ohlcIntervalSchema = t.Union([
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
]);


export const getRawPriceDataRequest = t.Object({
  poolAddress: t.String(),
  startTime: t.Number(),
  endTime: t.Number(),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")])))
});
export const getRawPriceDataResponse = t.Array(priceDataSchema);


export const getOhlcPriceDataRequest = t.Object({
  poolAddress: t.String(),
  interval: ohlcIntervalSchema,
  startTime: t.Number(),
  endTime: t.Number(),
  limit: t.Optional(t.Number())
});
export const getOhlcPriceDataResponse = t.Array(ohlcDataSchema);

import Redis from "ioredis";
import { TracingDecorator } from "./tracingDecorator";

@TracingDecorator({
  deep: 10,
  privateEnabled: true,
  prefix: 'REDIS',
  exclude: [
    'sendCommand'
  ]
})
export class RedisWithTracing extends Redis {
  constructor(url: string) {
    super(url)
  }
}
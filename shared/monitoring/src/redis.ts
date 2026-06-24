
import Redis from "ioredis";
import { TracingDecoratorClass } from "./tracingDecoratorClass";

@TracingDecoratorClass({
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
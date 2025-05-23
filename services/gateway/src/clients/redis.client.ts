
import Redis from "ioredis";
import { CONFIG } from "../config";

export const redisClient = new Redis(CONFIG.REDIS.URL);
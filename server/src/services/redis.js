import IORedis from "ioredis";
import { env } from "../config/env.js";

export const redis = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

export async function checkRedisHealth() {
  const pong = await redis.ping();
  return pong === "PONG";
}

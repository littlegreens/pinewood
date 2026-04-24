import { Queue } from "bullmq";
import { redis } from "./redis.js";

const connection = redis.duplicate();

export const gpxQueue = new Queue("gpx", { connection });
export const elevationQueue = new Queue("elevation", { connection });
export const sessionSyncQueue = new Queue("session-sync", { connection });

import { Worker } from "bullmq";
import { redis } from "./redis.js";
import { processTrailPois } from "./poiService.js";

const connection = redis.duplicate();
let worker;

export function startPoiWorker() {
  if (worker) return worker;

  worker = new Worker(
    "pois",
    async (job) => {
      const result = await processTrailPois(job.data.trailId, { force: Boolean(job.data.force) });
      return result;
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 1, duration: 1500 },
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[poi-worker] failed", job?.data?.trailId, err?.message || err);
  });

  worker.on("error", (error) => {
    console.error("[poi-worker] error:", error);
  });

  return worker;
}

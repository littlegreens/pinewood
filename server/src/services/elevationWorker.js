import { Worker } from "bullmq";
import { redis } from "./redis.js";
import { markTrailElevationFallback, processTrailElevation } from "./elevationService.js";

const connection = redis.duplicate();

let worker;

export function startElevationWorker() {
  if (worker) return worker;

  worker = new Worker(
    "elevation",
    async (job) => {
      await processTrailElevation(job.data.trailId, { force: Boolean(job.data.force) });
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("failed", async (job) => {
    if (!job) return;
    const maxAttempts = job.opts?.attempts || 1;
    if (job.attemptsMade >= maxAttempts) {
      await markTrailElevationFallback(job.data.trailId);
    }
  });

  worker.on("error", (error) => {
    console.error("Elevation worker error:", error);
  });

  return worker;
}

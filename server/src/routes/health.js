import { Router } from "express";
import { checkDbHealth } from "../db/pool.js";
import { checkRedisHealth } from "../services/redis.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [db, redis] = await Promise.all([checkDbHealth(), checkRedisHealth()]);

    res.json({
      ok: db && redis,
      service: "pinewood-api",
      checks: { db, redis },
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: "pinewood-api",
      error: "Health check failed",
    });
  }
});

export default router;

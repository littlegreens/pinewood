import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import trailsRouter from "./routes/trails.js";
import sessionsRouter from "./routes/sessions.js";
import weatherRouter from "./routes/weather.js";
import savedTrailsRouter from "./routes/savedTrails.js";
import parkingsRouter from "./routes/parkings.js";
import usersRouter from "./routes/users.js";
import adminUsersRouter from "./routes/adminUsers.js";
import { startElevationWorker } from "./services/elevationWorker.js";
import { purgeExpiredRefreshTokens } from "./services/authTokens.js";
import { ensureUploadsRoot, getUploadsRoot } from "./services/fileStorage.js";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Dev mode: allow all origins (including Tailscale hostnames/IPs).
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
await ensureUploadsRoot();
app.use("/uploads", express.static(getUploadsRoot()));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/trails", trailsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/saved-trails", savedTrailsRouter);
app.use("/api/parkings", parkingsRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin", adminUsersRouter);

startElevationWorker();
setInterval(() => {
  purgeExpiredRefreshTokens().catch((error) => {
    console.error("[auth] purge refresh tokens failed", error?.message || error);
  });
}, 6 * 60 * 60 * 1000);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Pinewood API su http://0.0.0.0:${env.port}`);
});

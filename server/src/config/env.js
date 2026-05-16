import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const OFFICIAL_SITE_URL = "https://pinewood.to";

function resolveClientUrl() {
  const explicit = String(process.env.CLIENT_URL || "").trim();
  const fallback = isProduction ? OFFICIAL_SITE_URL : "http://localhost:5173";
  let url = (explicit || fallback).replace(/\/$/, "");
  if (isProduction && /localhost|127\.0\.0\.1/i.test(url)) {
    console.warn(
      `[env] CLIENT_URL="${url}" non valido in produzione; uso ${OFFICIAL_SITE_URL}`
    );
    url = OFFICIAL_SITE_URL;
  }
  return url;
}

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL mancante: configura la connessione Supabase.");
}

export const env = {
  port: Number(process.env.PORT || 3001),
  clientUrl: resolveClientUrl(),
  databaseUrl,
  redisUrl: process.env.REDIS_URL || "redis://redis:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
  refreshSecret:
    process.env.REFRESH_SECRET || "dev-refresh-secret-change-in-production",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: String(process.env.SMTP_SECURE || "true") === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  /**
   * Dataset OpenTopoData (path dopo /v1/). Esempi: "srtm30m" (~30 m, SRTM GL1),
   * "eudem25m,srtm30m" (EU-DEM prima, poi SRTM fuori EU / nodata). Non esiste "srtm1" sulla API pubblica.
   */
  opentopoDataset: process.env.OPENTOPO_DATASET || "eudem25m,srtm30m",
};

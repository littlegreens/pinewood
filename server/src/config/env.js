import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL mancante: configura la connessione Supabase.");
}

export const env = {
  port: Number(process.env.PORT || 3001),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
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
  /** Opzionale: se assente, l'arricchimento descrizione (solo super_admin) viene saltato */
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  trailAiDebug: String(process.env.TRAIL_AI_DEBUG || "false").toLowerCase() === "true",
};

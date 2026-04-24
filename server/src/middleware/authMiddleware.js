import { verifyAccessToken } from "../services/authTokens.js";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing access token" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || "user",
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

export function optionalAuthMiddleware(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || "user",
    };
  } catch {
    req.user = null;
  }
  return next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ error: "Accesso riservato al super admin" });
  }
  return next();
}

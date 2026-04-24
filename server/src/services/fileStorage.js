import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(moduleDir, "../..");
const configuredUploadsRoot = String(process.env.UPLOADS_ROOT || "").trim();
const uploadsRoot = path.resolve(serverRoot, configuredUploadsRoot || "uploads");

export function getUploadsRoot() {
  return uploadsRoot;
}

export function ensureUploadsRoot() {
  return fs.mkdir(uploadsRoot, { recursive: true });
}

export function normalizeStoredUploadPath(value) {
  if (!value) return null;
  let normalized = String(value).trim();
  if (!normalized) return null;
  normalized = normalized.replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/")) return normalized.slice("/uploads/".length);
  if (normalized.startsWith("uploads/")) return normalized.slice("uploads/".length);
  if (normalized.startsWith("/")) return normalized.slice(1);
  return normalized;
}

export function resolveUploadAbsolutePath(storedPath) {
  const relative = normalizeStoredUploadPath(storedPath);
  if (!relative) return null;
  const absolute = path.resolve(uploadsRoot, relative);
  const rootWithSep = uploadsRoot.endsWith(path.sep) ? uploadsRoot : `${uploadsRoot}${path.sep}`;
  if (absolute !== uploadsRoot && !absolute.startsWith(rootWithSep)) {
    return null;
  }
  return absolute;
}

export async function deleteUploadFileSafe(storedPath) {
  const absolute = resolveUploadAbsolutePath(storedPath);
  if (!absolute) return false;
  try {
    await fs.unlink(absolute);
    await pruneEmptyUploadParents(path.dirname(absolute));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    console.error("[uploads] delete failed", absolute, error?.message || error);
    return false;
  }
}

async function pruneEmptyUploadParents(startDir) {
  let current = startDir;
  while (current && current !== uploadsRoot) {
    try {
      await fs.rmdir(current);
      current = path.dirname(current);
    } catch (error) {
      if (error?.code === "ENOENT") {
        current = path.dirname(current);
        continue;
      }
      // Directory non vuota o non eliminabile: stop pruning.
      break;
    }
  }
}

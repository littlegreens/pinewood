import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { getUploadsRoot } from "../services/fileStorage.js";

const uploadsDir = getUploadsRoot();
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = String(req.user?.id || "anonymous");
    const target = path.join(uploadsDir, "gpx", userId);
    fs.mkdirSync(target, { recursive: true });
    cb(null, target);
  },
  filename: (req, file, cb) => {
    const safeOriginal = path
      .basename(file.originalname || "track.gpx")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_");
    const safeName = `${Date.now()}-${safeOriginal}`;
    cb(null, safeName);
  },
});

function fileFilter(req, file, cb) {
  const lower = file.originalname.toLowerCase();
  if (lower.endsWith(".gpx") || lower.endsWith(".kml")) {
    return cb(null, true);
  }
  return cb(new Error("Sono supportati solo file GPX/KML"));
}

export const upload = multer({ storage, fileFilter });

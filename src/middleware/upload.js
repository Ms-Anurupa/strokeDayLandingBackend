import multer from "multer";
import path from "path";
import fs from "fs";

// Root folder for uploads. Must live on persistent disk in production.
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || "uploads");
export const VIDEO_DIRECTORY = path.join(UPLOAD_ROOT, "videos");

export const MAX_VIDEO_SIZE_MB = Number(process.env.MAX_VIDEO_SIZE_MB) || 100;

const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".m4v",
  ".mkv",
  ".3gp",
  ".avi",
]);

const EXTENSION_BY_MIME = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-m4v": ".m4v",
  "video/x-matroska": ".mkv",
  "video/3gpp": ".3gp",
  "video/x-msvideo": ".avi",
};

if (!fs.existsSync(VIDEO_DIRECTORY)) {
  fs.mkdirSync(VIDEO_DIRECTORY, {
    recursive: true,
  });
}

function safeExtension(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (ALLOWED_EXTENSIONS.has(extension)) return extension;

  // Browser-recorded videos often arrive without a usable extension.
  const mime = (file.mimetype || "").split(";")[0];
  return EXTENSION_BY_MIME[mime] || ".mp4";
}

/** Video MIME type to store, worked out from the extension when the browser's was unusable. */
export function videoMimeType(file) {
  const mime = String(file.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) return mime;

  const extension = path.extname(file.filename || file.originalname || "").toLowerCase();
  const match = Object.entries(EXTENSION_BY_MIME).find(([, ext]) => ext === extension);
  return match ? match[0] : "video/mp4";
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEO_DIRECTORY);
  },

  filename: (req, file, cb) => {
    const filename =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
      safeExtension(file);

    cb(null, filename);
  },
});

// Browser recordings send types like "video/webm;codecs=vp8,opus", which some
// parsers report oddly, so a known video extension is accepted as well.
function isVideo(file) {
  const mime = String(file.mimetype || "").toLowerCase();
  if (mime.startsWith("video/")) return true;

  const extension = path.extname(file.originalname || "").toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
}

const fileFilter = (req, file, cb) => {
  if (!isVideo(file)) {
    const error = new Error("Only video files are allowed.");
    error.statusCode = 400;
    return cb(error);
  }

  cb(null, true);
};

export const uploadVideo = multer({
  storage,

  limits: {
    fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024,
    files: 1,
    fields: 30,
  },

  fileFilter,
});

// Runs multer and turns upload problems into JSON 400/413 responses.
export function handleVideoUpload(fieldName) {
  const middleware = uploadVideo.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) return next();

      if (error instanceof multer.MulterError) {
        const tooLarge = error.code === "LIMIT_FILE_SIZE";

        return res.status(tooLarge ? 413 : 400).json({
          success: false,
          message: tooLarge
            ? `Video is too large. The limit is ${MAX_VIDEO_SIZE_MB} MB.`
            : "Invalid upload. Please send a single video file.",
        });
      }

      next(error);
    });
  };
}

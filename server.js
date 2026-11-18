const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || "";
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "/var/data/uploads");
const MAX_FILE_MB = Math.max(1, Number(process.env.MAX_FILE_MB || 100));
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");

if (API_KEY.length < 32) {
  console.error("FATAL: Set API_KEY to a random secret of at least 32 characters.");
  process.exit(1);
}

fs.mkdirSync(STORAGE_DIR, { recursive: true });

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function requireApiKey(req, res, next) {
  const supplied = req.get("x-api-key") || (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!supplied || !safeEqual(supplied, API_KEY)) {
    return res.status(401).json({ success: false, error: "Unauthorized: invalid or missing API key" });
  }
  next();
}

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: "Too many upload requests. Try again later." }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, STORAGE_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 }
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lover Storage</title><style>body{font:16px system-ui;background:#10131b;color:#f5f5f5;display:grid;place-items:center;min-height:90vh;margin:0}.card{max-width:560px;padding:28px;border:1px solid #343a48;border-radius:18px;background:#191e29}h1{margin-top:0}code{color:#a9d4ff}</style></head><body><main class="card"><h1>♥ Lover Storage</h1><p>Private upload API is online.</p><p>Upload endpoint: <code>POST /api/upload</code></p><p>File endpoint: <code>/file/:filename</code></p><p>Check status: <code>/health</code></p></main></body></html>`);
});

app.get("/health", (_req, res) => res.json({ success: true, service: "Lover Storage", status: "online" }));

app.post("/api/upload", requireApiKey, uploadLimiter, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ success: false, error: `File exceeds ${MAX_FILE_MB} MB limit` });
      }
      return res.status(400).json({ success: false, error: err.message || "Upload failed" });
    }
    if (!req.file) return res.status(400).json({ success: false, error: "No file received. Use form field name: file" });

    const base = BASE_URL || `${req.protocol}://${req.get("host")}`;
    const url = `${base}/file/${encodeURIComponent(req.file.filename)}`;
    return res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  });
});

app.get("/file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename || filename !== req.params.filename || filename.includes("..")) {
    return res.status(400).send("Invalid filename");
  }
  const fullPath = path.join(STORAGE_DIR, filename);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return res.status(404).send("File not found");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.sendFile(fullPath);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lover Storage listening on port ${PORT}`);
  console.log(`Storage directory: ${STORAGE_DIR}`);
});

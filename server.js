const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");

const app = express();

// ==========================================
// ✅ MIDDLEWARE
// ==========================================
const allowedOrigins = [
  "https://all-clip-frontend.vercel.app", // Production
];

// Allow localhost and any LAN IP (192.168.x.x / 10.x.x.x / 172.16-31.x.x) on dev port 5173
const lanOriginRegex =
  /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):5173$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || lanOriginRegex.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    exposedHeaders: ["x-file-name"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Range", "ngrok-skip-browser-warning"],
  })
);

app.use(express.json());

// ==========================================
// ✅ THUMBNAIL PROXY
// fixes Instagram / Facebook broken thumbs
// ==========================================
app.get("/proxy/thumbnail", (req, res) => {
  const url = req.query.url;

  if (!url) return res.status(400).send("No URL");

  const client = url.startsWith("https") ? https : http;

  const request = client.get(
    url,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer":    "https://www.instagram.com/",
      },
    },
    (response) => {
      res.setHeader(
        "Content-Type",
        response.headers["content-type"] || "image/jpeg"
      );
      response.pipe(res);
    }
  );

  request.on("error", () => res.status(500).send("Failed"));
});

// ==========================================
// ✅ ROUTES
// ==========================================
app.use("/music", require("./socialMedia/musicDown"));
app.use("/video", require("./socialMedia/videoDown"));

// ==========================================
// ✅ ROOT
// ==========================================
app.get("/", (req, res) => {
  res.send("AllClip API Running 💚");
});

// ==========================================
// ✅ START
// ==========================================
app.listen(5000, () => {
  console.log("Server running on 5000 💚");
});
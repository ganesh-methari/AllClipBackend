const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");

const app = express();

// ==========================================
// ✅ MIDDLEWARE
// ==========================================
app.use(
  cors({
    origin: [
      "https://all-clip-frontend.vercel.app", // Production
      "http://localhost:5173",                // Localhost dev
      "http://127.0.0.1:5173",                // Localhost dev alt
      "http://192.168.0.106:5173"             // Local network dev
    ], // ✅ allowed frontend URLs
    exposedHeaders: ["x-file-name"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
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
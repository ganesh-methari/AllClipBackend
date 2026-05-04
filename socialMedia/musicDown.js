const express = require("express");
const router = express.Router();
const ytdlp = require("yt-dlp-exec");

// clean youtube url
function cleanUrl(url) {
  if (!url) return null;

  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }

  if (url.includes("youtube.com")) {
    const match = url.match(/v=([^&]+)/);
    if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
  }

  return url;
}

// 🔥 FREE PROXIES (replace with fresh ones if dead)
const proxies = [
  "http://103.21.244.38:80",
  "http://51.79.50.46:9300",
  "http://185.199.229.156:7492"
];

/* ================= INFO ================= */
router.post("/info", async (req, res) => {
  const url = cleanUrl(req.body.url);

  if (!url) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // pick random proxy
  const proxy = proxies[Math.floor(Math.random() * proxies.length)];

  try {
    const data = await ytdlp(url, {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      noCheckCertificates: true,
      userAgent: "Mozilla/5.0",
      proxy: proxy // 🔥 proxy added here
    });

    return res.json({
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration,
      uploader: data.uploader,
    });

  } catch (err) {
    console.error("YT ERROR:", err.message);

    return res.status(500).json({
      error: "yt-dlp failed",
      details: err.message,
    });
  }
});

/* ================= DOWNLOAD ================= */
router.get("/download", async (req, res) => {
  const url = cleanUrl(req.query.url);

  if (!url) return res.status(400).send("Invalid URL");

  const proxy = proxies[Math.floor(Math.random() * proxies.length)];

  try {
    const stream = ytdlp.execStream(url, {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0,
      output: "-",
      proxy: proxy
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'attachment; filename="audio.mp3"');

    stream.pipe(res);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Download failed");
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const { spawn, execFile, execFileSync } = require("child_process");
const https = require("https");
const http = require("http");

/* ================= CONFIG ================= */
const YTDLP = "yt-dlp"; // or full path if needed
const COOKIE_FILE = "cookies.txt";

/* ================= CLEAN URL ================= */
function getCleanUrl(url) {
  if (!url) return null;

  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }

  if (url.includes("youtube.com")) {
    const match = url.match(/v=([^&]+)/);
    if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
    return url;
  }

  if (
    url.includes("x.com") ||
    url.includes("facebook.com") ||
    url.includes("instagram.com") ||
    url.includes("vimeo.com") ||
    url.includes("soundcloud.com") ||
    url.includes("twitch.tv") ||
    url.includes("reddit.com") ||
    url.includes("bandcamp.com") ||
    url.includes("mixcloud.com") 
  ) {
    return url;
  }

  return null;
}

/* ================= SAFE FILE NAME ================= */
function safeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= BASE ARGS ================= */
function baseArgs(url) {
  return [
    "--cookies", COOKIE_FILE,
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "--sleep-interval", "2",
    "--max-sleep-interval", "5",
    "--no-playlist",
    url
  ];
}

/* ================= INFO ================= */
router.post("/info", (req, res) => {
  const cleanUrl = getCleanUrl(req.body.url);

  console.log("URL:", req.body.url);
  console.log("CLEAN:", cleanUrl);

  if (!cleanUrl) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  execFile(
    YTDLP,
    [...baseArgs(cleanUrl), "-j"],
    { maxBuffer: 50 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        console.error("YT-DLP ERROR:", stderr || err.message);

        return res.status(500).json({
          error: "yt-dlp failed",
          details: stderr || err.message,
        });
      }

      try {
        const lines = stdout.trim().split("\n");
        const data = JSON.parse(lines[lines.length - 1]);

        let thumbnail =
          data.thumbnail ||
          (data.thumbnails?.length
            ? data.thumbnails[data.thumbnails.length - 1].url
            : null);

        if (thumbnail) {
          thumbnail = `${req.protocol}://${req.get("host")}/media/thumbnail?url=${encodeURIComponent(thumbnail)}`;
        }

        res.json({
          title: data.title,
          thumbnail,
          duration: data.duration,
          uploader: data.uploader,
        });
      } catch (e) {
        console.error("PARSE ERROR:", e.message);

        res.status(500).json({
          error: "JSON parse error",
          details: e.message,
        });
      }
    }
  );
});

/* ================= THUMBNAIL ================= */
router.get("/thumbnail", (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send("No URL");

  const client = imageUrl.startsWith("https") ? https : http;

  client
    .get(imageUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (proxyRes) => {
      res.setHeader("Content-Type", proxyRes.headers["content-type"]);
      res.setHeader("Access-Control-Allow-Origin", "*");
      proxyRes.pipe(res);
    })
    .on("error", () => {
      res.status(500).send("Thumbnail error");
    });
});

/* ================= DOWNLOAD MP3 ================= */
router.get("/download", (req, res) => {
  const cleanUrl = getCleanUrl(req.query.url);

  if (!cleanUrl) {
    return res.status(400).send("Invalid URL");
  }

  let title = "audio";

  try {
    title = execFileSync(YTDLP, [
      "--cookies", COOKIE_FILE,
      "--get-title",
      "--no-playlist",
      cleanUrl,
    ])
      .toString()
      .trim()
      .split("\n")[0];
  } catch {}

  title = safeFileName(title);

  const process = spawn(YTDLP, [
    ...baseArgs(cleanUrl),
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "-o", "-",
  ]);

  const asciiTitle = title.replace(/[^\x20-\x7E]/g, "") || "audio";
  const encodedTitle = encodeURIComponent(title);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiTitle}.mp3"; filename*=UTF-8''${encodedTitle}.mp3`
  );

  res.setHeader("Content-Type", "audio/mpeg");

  process.stdout.pipe(res);

  process.stderr.on("data", (d) => {
    console.log(d.toString());
  });

  process.on("error", () => {
    if (!res.headersSent) {
      res.status(500).send("Download failed");
    }
  });

  process.on("close", () => {
    res.end();
  });
});

module.exports = router;
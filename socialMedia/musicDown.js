const express = require("express");
const router = express.Router();
const { spawn, execFile, execFileSync } = require("child_process");
const https = require("https");
const http = require("http");

/* =========================
   CLEAN URL
========================= */
function getCleanUrl(url) {
  if (!url) return null;

  // YouTube short
  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }

  // YouTube normal
  if (url.includes("youtube.com")) {
    const match = url.match(/v=([^&]+)/);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
    return url;
  }

  // Audio platforms
  if (
    url.includes("soundcloud.com") ||
    url.includes("bandcamp.com") ||
    url.includes("mixcloud.com")
  ) {
    return url;
  }

  return null;
}

/* =========================
   SAFE FILE NAME
========================= */
function safeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   INFO API
========================= */
router.post("/info", (req, res) => {
  const cleanUrl = getCleanUrl(req.body.url);

  if (!cleanUrl) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  execFile(
    "yt-dlp",
    ["-j", "--no-playlist", cleanUrl],
    { maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          error: "yt-dlp failed",
          details: stderr || err.message,
        });
      }

      try {
        const data = JSON.parse(stdout.trim().split("\n")[0]);

        let thumbnail =
          data.thumbnail ||
          (data.thumbnails?.length
            ? data.thumbnails[data.thumbnails.length - 1].url
            : null);

        if (thumbnail) {
          thumbnail = thumbnail.replace(/&amp;/g, "&");
          thumbnail = `${req.protocol}://${req.get("host")}/media/thumbnail?url=${encodeURIComponent(
            thumbnail
          )}`;
        }

        res.json({
          title: data.title,
          thumbnail,
          duration: data.duration,
          uploader: data.uploader,
        });
      } catch {
        res.status(500).json({ error: "JSON parse error" });
      }
    }
  );
});

/* =========================
   THUMBNAIL PROXY
========================= */
router.get("/thumbnail", (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send("No URL");

  const client = imageUrl.startsWith("https") ? https : http;

  client
    .get(
      imageUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      },
      (proxyRes) => {
        if (proxyRes.headers["content-type"]) {
          res.setHeader("Content-Type", proxyRes.headers["content-type"]);
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        proxyRes.pipe(res);
      }
    )
    .on("error", () => {
      res.status(500).send("Thumbnail error");
    });
});

/* =========================
   DOWNLOAD MP3
========================= */
router.get("/download", (req, res) => {
  const cleanUrl = getCleanUrl(req.query.url);

  if (!cleanUrl) {
    return res.status(400).send("Invalid URL");
  }

  let title = "audio";

  try {
    title = execFileSync("yt-dlp", [
      "--get-title",
      "--no-playlist",
      cleanUrl,
    ])
      .toString()
      .trim()
      .split("\n")[0];
  } catch {
    title = "audio";
  }

  title = safeFileName(title);

  const process = spawn("yt-dlp", [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--no-playlist",
    "-o",
    "-",
    cleanUrl,
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
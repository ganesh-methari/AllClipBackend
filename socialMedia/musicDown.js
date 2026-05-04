const express = require("express");
const router = express.Router();
const { spawn, execFile } = require("child_process");

const YTDLP = "yt-dlp";

/* ================= CLEAN URL ================= */
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

/* ================= GET INFO ================= */
router.post("/info", (req, res) => {
  const url = cleanUrl(req.body.url);

  if (!url) return res.status(400).json({ error: "Invalid URL" });

  execFile(
    YTDLP,
    ["-j", "--no-playlist", url],
    { maxBuffer: 50 * 1024 * 1024 },
    (err, stdout) => {
      if (err) {
        return res.status(500).json({ error: "yt-dlp failed" });
      }

      try {
        const data = JSON.parse(stdout.split("\n").pop());

        res.json({
          title: data.title,
          duration: data.duration,
          uploader: data.uploader,
          thumbnail: data.thumbnail,
        });
      } catch {
        res.status(500).json({ error: "Parse error" });
      }
    }
  );
});

/* ================= DOWNLOAD ================= */
router.get("/download", (req, res) => {
  const url = cleanUrl(req.query.url);

  if (!url) return res.status(400).send("Invalid URL");

  const process = spawn(YTDLP, [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--no-playlist",
    "-o",
    "-",
    url,
  ]);

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="audio.mp3"`
  );

  process.stdout.pipe(res);

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
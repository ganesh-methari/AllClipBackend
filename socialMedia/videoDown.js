const express = require("express");
const router = express.Router();
const { spawn, execFile } = require("child_process");

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

  // Supported video platforms
  if (
    url.includes("facebook.com") ||
    url.includes("instagram.com") ||
    url.includes("x.com") ||
    url.includes("vimeo.com") ||
    url.includes("twitch.tv") ||
    url.includes("reddit.com")
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
   VIDEO INFO
========================= */
router.post("/info", (req, res) => {
  const cleanUrl = getCleanUrl(req.body.url);

  if (!cleanUrl) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  execFile(
    "yt-dlp",
    ["-j", "--no-playlist", cleanUrl],
    { maxBuffer: 15 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          error: "yt-dlp failed",
          details: stderr || err.message,
        });
      }

      try {
        const data = JSON.parse(stdout.trim().split("\n")[0]);

        res.json({
          title: data.title,
          thumbnail: data.thumbnail,
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
   DOWNLOAD VIDEO (MP4)
========================= */
router.get("/download", (req, res) => {
  const cleanUrl = getCleanUrl(req.query.url);

  if (!cleanUrl) {
    return res.status(400).send("Invalid URL");
  }

  let title = "video";

  // Fetch title
  try {
    title = require("child_process")
      .execFileSync("yt-dlp", ["--get-title", "--no-playlist", cleanUrl])
      .toString()
      .trim()
      .split("\n")[0];
  } catch {
    title = "video";
  }

  title = safeFileName(title);

  /* =========================
     yt-dlp process
     bestvideo + bestaudio merged into mp4
  ========================= */
const process = spawn("yt-dlp", [
  "-f", "best[height<=720]",
  "-N", "4",
  "--no-playlist",
  "-o", "-",
  cleanUrl,
]);

  const asciiTitle = title.replace(/[^\x20-\x7E]/g, "") || "video";
  const encodedTitle = encodeURIComponent(title);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiTitle}.mp4"; filename*=UTF-8''${encodedTitle}.mp4`
  );
  res.setHeader("Content-Type", "video/mp4");

  process.stdout.pipe(res);

  process.stderr.on("data", (d) => {
    console.log("yt-dlp:", d.toString());
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
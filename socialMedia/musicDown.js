// ==========================================
// ✅ musicDown.js
// ==========================================

const express = require("express");
const router = express.Router();

const { spawn } = require("child_process");

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// ==========================================
// ✅ CLEAN URL
// ==========================================
function cleanUrl(url) {
  if (!url) return null;

  // youtu.be
  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];

    return `https://www.youtube.com/watch?v=${id}`;
  }

  // youtube.com
  if (url.includes("youtube.com")) {
    const match = url.match(/v=([^&]+)/);

    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }

  return url;
}

// ==========================================
// ✅ VALIDATE URL
// ==========================================
function isValidUrl(url) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

// ==========================================
// ✅ ESTIMATE SIZE
// ==========================================
function estimateSize(bitrate, duration) {
  if (!duration) return "~";

  const sizeMB = (bitrate * duration) / 8 / 1024;

  return sizeMB.toFixed(1) + " MB";
}

// ==========================================
// ✅ INFO API
// ==========================================
router.post("/info", (req, res) => {
  const url = cleanUrl(req.body.url);

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      error: "Invalid YouTube URL ❌",
    });
  }

  const yt = spawn("yt-dlp", ["--js-runtimes", "node", "-j", url]);

  let data = "";

  yt.stdout.on(
    "data",

    (chunk) => {
      data += chunk;
    },
  );

  yt.stderr.on(
    "data",

    (d) => {
      console.log(d.toString());
    },
  );

  yt.on("close", () => {
    try {
      const json = JSON.parse(data);

      const duration = json.duration;

      // ==========================================
      // ✅ ORIGINAL AUDIO
      // ==========================================
      const m4aFormats = json.formats

        .filter((f) => f.acodec !== "none" && f.vcodec === "none")

        .map((f) => ({
          format_id: f.format_id,

          bitrate: Math.round(f.abr || f.tbr || 0),

          size: f.filesize
            ? (f.filesize / 1024 / 1024).toFixed(1) + " MB"
            : estimateSize(
                Math.round(f.abr || f.tbr || 0),

                duration,
              ),

          ext: f.ext,
        }))

        .filter((f) => f.ext === "m4a")

        .sort((a, b) => b.bitrate - a.bitrate);

      // ==========================================
      // ✅ MP3 OPTIONS
      // ==========================================
      const mp3Formats = [320, 256, 160].map((b) => ({
        format_id: `mp3-${b}`,

        bitrate: b,

        size: estimateSize(b, duration),

        ext: "mp3",
      }));

      res.json({
        title: json.title,

        thumbnail: json.thumbnail,

        formats: [...m4aFormats, ...mp3Formats],
      });
    } catch (err) {
      console.log(err);

      res.status(500).json({
        error: "Failed to fetch video ❌",
      });
    }
  });

  yt.on(
    "error",

    (err) => {
      console.log(err);

      res.status(500).json({
        error: "yt-dlp crashed ❌",
      });
    },
  );
});

// ==========================================
// ✅ DOWNLOAD API
// ==========================================
router.get(
  "/download",

  (req, res) => {
    const url = cleanUrl(req.query.url);

    const format = req.query.format;

    if (!url || !format) {
      return res.status(400).json({
        error: "Missing data ❌",
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        error: "Invalid YouTube URL ❌",
      });
    }

    // ==========================================
    // ✅ UNIQUE ID
    // ==========================================
    const id = crypto.randomBytes(6).toString("hex");

    // ==========================================
    // ✅ TEMP FILE
    // ==========================================
    const outputTemplate = path.join(
      os.tmpdir(),

      `${id}-%(title).100s.%(ext)s`,
    );

    let args = [];

    // ==========================================
    // ✅ MP3 CONVERT
    // ==========================================
    if (format.startsWith("mp3-")) {
      const bitrate = format.split("-")[1];

args = [

  "--js-runtimes",
  "node",

  "-f",
  "bestaudio",

  "-x",

  "--audio-format",
  "mp3",

  "--audio-quality",
  "5",

  "--no-playlist",

  "--newline",

  "-o",
  outputTemplate,

  url,
];
    }

    // ==========================================
    // ✅ DIRECT AUDIO
    // ==========================================
    else {
      args = ["--js-runtimes", "node", "-f", format, "-o", outputTemplate, url];
    }

    const yt = spawn("yt-dlp", args);

    yt.stderr.on(
      "data",

      (d) => {
        console.log(d.toString());
      },
    );

    yt.on(
      "close",

      (code) => {
        if (code !== 0) {
          return res.status(500).json({
            error: "Download failed ❌",
          });
        }

        fs.readdir(
          os.tmpdir(),

          (err, files) => {
            if (err) {
              return res.status(500).json({
                error: "File error ❌",
              });
            }

            // ==========================================
            // ✅ FIND FILE
            // ==========================================
            const file = files.find((f) => f.startsWith(id));

            if (!file) {
              return res.status(500).json({
                error: "File not found ❌",
              });
            }

            const fullPath = path.join(os.tmpdir(), file);

            // ==========================================
            // ✅ REMOVE RANDOM ID
            // ==========================================
            let originalName = file.replace(/^[a-f0-9]+-/, "");

            // ==========================================
            // ✅ SAFE FILE NAME
            // ==========================================
            const safeFileName = originalName

              // remove emoji/unicode
              .replace(/[^\x00-\x7F]/g, "")

              // invalid chars
              .replace(/[<>:"/\\|?*]/g, "")

              // trim
              .trim();

            // ==========================================
            // ✅ CUSTOM HEADER
            // ==========================================
            res.setHeader(
              "x-file-name",

              encodeURIComponent(safeFileName),
            );

            // ==========================================
            // ✅ CONTENT TYPE
            // ==========================================
            res.setHeader("Content-Type", "audio/mpeg");

            // ==========================================
            // ✅ SEND FILE
            // ==========================================
            res.sendFile(
              fullPath,

              (err) => {
                // delete temp file
                fs.unlink(fullPath, () => {});

                if (err) {
                  console.log(err);
                }
              },
            );
          },
        );
      },
    );

    yt.on(
      "error",

      (err) => {
        console.log(err);

        res.status(500).json({
          error: "yt-dlp crashed ❌",
        });
      },
    );
  },
);

module.exports = router;

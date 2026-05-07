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
// ✅ SUPPORTED SITES
// ==========================================
const supportedSites = [
  "youtube.com",
  "youtu.be",

  "instagram.com",

  "facebook.com",

  "x.com",
  "twitter.com",

  "vimeo.com",

  "twitch.tv",

  "reddit.com",

  "soundcloud.com",

  "bandcamp.com",

  "mixcloud.com",
];

// ==========================================
// ✅ CLEAN URL
// ==========================================
function cleanUrl(url) {
  if (!url) return null;

  url = url.trim();

  // ==========================================
  // ✅ YOUTUBE SHORT LINK
  // ==========================================
  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];

    return `https://www.youtube.com/watch?v=${id}`;
  }

  // ==========================================
  // ✅ NORMAL YOUTUBE
  // ==========================================
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
  if (!url) return false;

  return supportedSites.some((site) => url.includes(site));
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
router.post(
  "/info",

  (req, res) => {
    const url = cleanUrl(req.body.url);

    // ==========================================
    // ✅ VALIDATION
    // ==========================================
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL ❌",
      });
    }

    // ==========================================
    // ✅ yt-dlp
    // ==========================================
    const yt = spawn(
      "yt-dlp",

      ["--js-runtimes", "node", "-j", url],
    );

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

    yt.on(
      "close",

      () => {
        try {
          const json = JSON.parse(data);

          const duration = json.duration;

          // ==========================================
          // ✅ AUDIO FORMATS
          // ==========================================
          const audioFormats = json.formats

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

            formats: [...audioFormats, ...mp3Formats],
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            error: "Failed to fetch media ❌",
          });
        }
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

// ==========================================
// ✅ DOWNLOAD API
// ==========================================
router.get(
  "/download",

  (req, res) => {
    const url = cleanUrl(req.query.url);

    const format = req.query.format;

    // ==========================================
    // ✅ VALIDATION
    // ==========================================
    if (!url || !format) {
      return res.status(400).json({
        error: "Missing data ❌",
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL ❌",
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

    // ==========================================
    // ✅ START yt-dlp
    // ==========================================
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

        // ==========================================
        // ✅ FIND FILE
        // ==========================================
        fs.readdir(
          os.tmpdir(),

          (err, files) => {
            if (err) {
              return res.status(500).json({
                error: "File error ❌",
              });
            }

            const file = files.find((f) => f.startsWith(id));

            if (!file) {
              return res.status(500).json({
                error: "File not found ❌",
              });
            }

            const fullPath = path.join(os.tmpdir(), file);

            // ==========================================
            // ✅ CLEAN FILE NAME
            // ==========================================
            let originalName = file.replace(/^[a-f0-9]+-/, "");

            const safeFileName = originalName

              .replace(/[^\x00-\x7F]/g, "")

              .replace(/[<>:"/\\|?*]/g, "")

              .trim();

            // ==========================================
            // ✅ HEADERS
            // ==========================================
            res.setHeader(
              "x-file-name",

              encodeURIComponent(safeFileName),
            );

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

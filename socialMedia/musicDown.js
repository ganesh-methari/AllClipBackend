// ==========================================
// ✅ musicDown.js (SAFE VERSION)
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

  // youtube short
  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];

    return `https://www.youtube.com/watch?v=${id}`;
  }

  // normal youtube
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
// ✅ SAFE ERROR RESPONSE
// ==========================================
function sendError(res, code, message) {
  if (!res.headersSent) {
    return res.status(code).json({
      error: message,
    });
  }
}

// ==========================================
// ✅ INFO API
// ==========================================
router.post("/info", async (req, res) => {

  try {

    const url =
      cleanUrl(req.body.url);

    // ✅ VALIDATE
    if (
      !url ||
      !isValidUrl(url)
    ) {

      return res
        .status(400)
        .json({
          error:
            "Invalid URL ❌",
        });
    }

    // ✅ yt-dlp
    const yt = spawn(
      "yt-dlp",

      [
        "--js-runtimes",
        "node",

        "-j",

        url,
      ]
    );

    let data = "";

    // ==========================================
    // ✅ OUTPUT
    // ==========================================
    yt.stdout.on(
      "data",

      (chunk) => {
        data += chunk;
      }
    );

    // ==========================================
    // ✅ ERROR LOG
    // ==========================================
    yt.stderr.on(
      "data",

      (d) => {
        console.log(
          d.toString()
        );
      }
    );

    // ==========================================
    // ✅ FINISH
    // ==========================================
    yt.on(
      "close",

      (code) => {

        // already sent
        if (
          res.headersSent
        )
          return;

        // failed
        if (code !== 0) {

          return res
            .status(500)
            .json({
              error:
                "yt-dlp failed ❌",
            });
        }

        try {

          const json =
            JSON.parse(data);

          const duration =
            json.duration;

          // ==========================================
          // ✅ AUDIO
          // ==========================================
          const audioFormats =
            json.formats

              .filter(
                (f) =>
                  f.acodec !==
                    "none" &&
                  f.vcodec ===
                    "none"
              )

              .map((f) => ({

                format_id:
                  f.format_id,

                bitrate:
                  Math.round(
                    f.abr ||
                      f.tbr ||
                      0
                  ),

                size:
                  f.filesize

                    ? (
                        f.filesize /
                        1024 /
                        1024
                      ).toFixed(1) +
                      " MB"

                    : estimateSize(
                        Math.round(
                          f.abr ||
                            f.tbr ||
                            0
                        ),

                        duration
                      ),

                ext: f.ext,
              }))

              .sort(
                (a, b) =>
                  b.bitrate -
                  a.bitrate
              );

          // ==========================================
          // ✅ MP3
          // ==========================================
          const mp3Formats =
            [320, 256, 160].map(
              (b) => ({
                format_id:
                  `mp3-${b}`,

                bitrate: b,

                size:
                  estimateSize(
                    b,
                    duration
                  ),

                ext: "mp3",
              })
            );

          // ==========================================
          // ✅ SEND
          // ==========================================
          return res.json({

            title:
              json.title,

            thumbnail:
              json.thumbnail,

            formats: [

              ...audioFormats,

              ...mp3Formats,
            ],
          });

        } catch (err) {

          console.log(err);

          if (
            !res.headersSent
          ) {

            return res
              .status(500)
              .json({
                error:
                  "Parse failed ❌",
              });
          }
        }
      }
    );

    // ==========================================
    // ✅ yt-dlp crash
    // ==========================================
    yt.on(
      "error",

      (err) => {

        console.log(err);

        if (
          !res.headersSent
        ) {

          return res
            .status(500)
            .json({
              error:
                "yt-dlp crashed ❌",
            });
        }
      }
    );

  } catch (err) {

    console.log(err);

    if (
      !res.headersSent
    ) {

      return res
        .status(500)
        .json({
          error:
            "Server error ❌",
        });
    }
  }
});

// ==========================================
// ✅ DOWNLOAD API
// ==========================================
router.get(
  "/download",

  (req, res) => {
    const url = cleanUrl(req.query.url);

    const format = req.query.format;

    // validation
    if (!url || !format) {
      return sendError(res, 400, "Missing data ❌");
    }

    if (!isValidUrl(url)) {
      return sendError(res, 400, "Invalid URL ❌");
    }

    // unique id
    const id = crypto.randomBytes(6).toString("hex");

    // output
    const outputTemplate = path.join(
      os.tmpdir(),

      `${id}-%(title).100s.%(ext)s`,
    );

    let args = [];

    // ==========================================
    // ✅ MP3
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
        // already sent
        if (res.headersSent) return;

        if (code !== 0) {
          return sendError(res, 500, "Download failed ❌");
        }

        // ==========================================
        // ✅ FIND FILE
        // ==========================================
        fs.readdir(
          os.tmpdir(),

          (err, files) => {
            if (err) {
              return sendError(res, 500, "File error ❌");
            }

            const file = files.find((f) => f.startsWith(id));

            if (!file) {
              return sendError(res, 500, "File not found ❌");
            }

            const fullPath = path.join(os.tmpdir(), file);

            // clean name
            let originalName = file.replace(/^[a-f0-9]+-/, "");

            const safeFileName = originalName

              .replace(/[^\x00-\x7F]/g, "")

              .replace(/[<>:"/\\|?*]/g, "")

              .trim();

            // headers
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
                if (err) {
                  console.log(err);

                  return;
                }

                // delete temp
                fs.unlink(fullPath, () => {});
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

        return sendError(res, 500, "yt-dlp crashed ❌");
      },
    );
  },
);

module.exports = router;

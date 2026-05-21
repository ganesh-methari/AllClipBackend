// ==========================================
// ✅ videoDown.js
// ==========================================

const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// ==========================================
// ✅ COOKIES PATH
// ==========================================
const cookiesPath = path.join(
  process.cwd(),
  "cookies.txt"
);

console.log("Cookies Path:", cookiesPath);
console.log("Cookies Exists:", fs.existsSync(cookiesPath));

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
  "reddit.com",
  "twitch.tv",
  "pinterest.com",
  "pin.it",
];

// ==========================================
// ✅ QUALITY LABELS
// ==========================================
const qualityLabel = {
  2160: "4K Ultra HD",
  1440: "2K QHD",
  1080: "Full HD",
  720:  "HD",
  480:  "SD",
  360:  "SD",
  240:  "SD",
  144:  "SD",
};

// ==========================================
// ✅ QUALITY BITRATE MAP
// ==========================================
const qualityBitrate = {
  2160: 15000,
  1440: 8000,
  1080: 4000,
  720:  2000,
  480:  1000,
  360:  600,
  240:  300,
  144:  150,
};

// ==========================================
// ✅ CLEAN URL
// ==========================================
function cleanUrl(url) {
  if (!url) return null;

  url = url.trim();

  // strip accidental chars before http
  const httpIndex = url.indexOf("http");
  if (httpIndex > 0) url = url.slice(httpIndex);

  if (url.includes("youtu.be")) {
    const id = url.split("/").pop().split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }

  return url;
}

// ==========================================
// ✅ VALID URL
// ==========================================
function isValidUrl(url) {
  return supportedSites.some((site) => url.includes(site));
}

// ==========================================
// ✅ SIZE ESTIMATE
// ==========================================
function estimateSize(bitrateKbps, duration) {
  if (!duration) return "~";
  const sizeMB = (bitrateKbps * duration) / 8 / 1024;
  return sizeMB.toFixed(1) + " MB";
}

// ==========================================
// ✅ GET BYTES — filesize → approx → 0
// ==========================================
function getBytes(f) {
  return f?.filesize || f?.filesize_approx || 0;
}

// ==========================================
// ✅ GET HEIGHT — height → resolution → null
// ==========================================
function getHeight(f) {
  if (f.height) return f.height;

  if (f.resolution && f.resolution !== "audio only") {
    const parts = f.resolution.split("x");
    if (parts.length === 2) {
      return parseInt(parts[1]) || parseInt(parts[0]) || null;
    }
  }

  return null;
}

// ==========================================
// ✅ COMMON yt-dlp ARGS
// ==========================================
function commonArgs() {
  const args = [
    "--no-playlist",
    "--user-agent",
    "Mozilla/5.0",
    "--js-runtimes",
    "node",
    "--quiet",
  ];

  if (fs.existsSync(cookiesPath)) {
    args.unshift(cookiesPath);
    args.unshift("--cookies");
  }

  return args;
}

// ==========================================
// ✅ INFO API
// ==========================================
router.post("/info", (req, res) => {
  try {
    const url = cleanUrl(req.body.url);

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: "Invalid URL ❌" });
    }

    const yt = spawn("yt-dlp", [
      ...commonArgs(),
      "-j",
      url,
    ]);

    let data = "";

    yt.stdout.on("data", (chunk) => { data += chunk; });
    yt.stderr.on("data", (d) => { console.log(d.toString()); });

    yt.on("close", (code) => {
      if (res.headersSent) return;

      if (code !== 0) {
        return res.status(500).json({ error: "Failed to fetch ❌" });
      }

      try {
        const json = JSON.parse(data);

        // ==========================================
        // ✅ BUILD FORMATS
        // ==========================================
        const seen = new Set();

        const formats = (json.formats || [])
          .filter((f) => {
            const h = getHeight(f);
            if (!h || seen.has(h)) return false;

            // video-only streams
            const hasVideo =
              f.vcodec && f.vcodec !== "none";

            // muxed streams (generic extractor)
            const isMuxed =
              ["mp4", "webm", "mov", "m4v"].includes(f.ext) &&
              f.acodec !== "none";

            if (!hasVideo && !isMuxed) return false;

            seen.add(h);
            return true;
          })
          .sort((a, b) => getHeight(b) - getHeight(a))
          .map((f) => {
            const h = getHeight(f);

            // best audio stream
            const bestAudio = (json.formats || [])
              .filter(
                (a) => a.acodec !== "none" && a.vcodec === "none"
              )
              .sort((a, b) => getBytes(b) - getBytes(a))[0];

            // best video stream at this height
            const bestVideo = (json.formats || [])
              .filter(
                (v) => v.vcodec !== "none" && getHeight(v) === h
              )
              .sort((a, b) => getBytes(b) - getBytes(a))[0];

            const totalBytes =
              getBytes(bestVideo) + getBytes(bestAudio);

            const size =
              totalBytes > 0
                ? "~" + (totalBytes / 1024 / 1024).toFixed(1) + " MB"
                : "~" + estimateSize(
                    qualityBitrate[h] || 1000,
                    json.duration
                  );

            return {
              height:  h,
              quality: `${h}p`,
              ext:     f.ext || "mp4",
              size,
              label:   qualityLabel[h] || "",
            };
          });

        return res.json({
          title:     json.title,
          thumbnail: json.thumbnail,
          duration:  json.duration,
          uploader:  json.uploader || "",
          formats,
        });

      } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Parse failed ❌" });
      }
    });

    yt.on("error", (err) => {
      console.log(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "yt-dlp crashed ❌" });
      }
    });

  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error ❌" });
    }
  }
});

// ==========================================
// ✅ DOWNLOAD API (streaming via yt-dlp stdout, combined formats)
// ==========================================
router.get("/download", (req, res) => {
  try {
    const url    = cleanUrl(req.query.url);
    const height = req.query.height;

    if (!url || !height) {
      return res.status(400).json({ error: "Missing data ❌" });
    }

    const passedTitle = (req.query.title || "video").toString();
    const safeTitle = passedTitle.replace(/[<>:"/\\|?*\n\r]/g, "").slice(0, 80);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("x-file-name", encodeURIComponent(`${safeTitle} [${height}p].mp4`));

    const formatStr =
      `best[height<=${height}][ext=mp4]` +
      `/best[height<=${height}]`;

    const args = [
      ...commonArgs(),
      "--downloader", "aria2c",
      "--downloader-args", "aria2c:-x 16 -s 16 -k 1M",
      "-f", formatStr,
      "-o", "-",
      url,
    ];

    const yt = spawn("yt-dlp", args);
    yt.stdout.pipe(res);
    yt.stderr.on("data", (d) => console.log(d.toString()));
    yt.on("close", (code) => {
      if (code !== 0 && !res.headersSent) res.status(500).end();
    });
    yt.on("error", (err) => {
      console.log(err);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error ❌" });
    }
  }
});

module.exports = router;
// ==========================================
// ✅ musicDown.js
// ==========================================

const express = require("express");

const router = express.Router();

const { spawn } =
  require("child_process");

const fs = require("fs");

const path = require("path");

const os = require("os");

const crypto =
  require("crypto");

// ==========================================
// ✅ COOKIES PATH
// ==========================================
const cookiesPath =
  path.join(
    process.cwd(),
    "cookies.txt"
  );

// ==========================================
// ✅ DEBUG
// ==========================================
console.log(
  "Cookies Path:",
  cookiesPath
);

console.log(
  "Cookies Exists:",
  fs.existsSync(
    cookiesPath
  )
);

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

  "soundcloud.com",
];

// ==========================================
// ✅ CLEAN URL
// ==========================================
function cleanUrl(url) {

  if (!url) return null;

  url = url.trim();

  // youtube short
  if (
    url.includes("youtu.be")
  ) {

    const id =
      url
        .split("/")
        .pop()
        .split("?")[0];

    return `https://www.youtube.com/watch?v=${id}`;
  }

  return url;
}

// ==========================================
// ✅ VALID URL
// ==========================================
function isValidUrl(url) {

  return supportedSites.some(
    (site) =>
      url.includes(site)
  );
}

// ==========================================
// ✅ SIZE
// ==========================================
function estimateSize(
  bitrate,
  duration
) {

  if (!duration) return "~";

  const sizeMB =
    (bitrate * duration) /
    8 /
    1024;

  return (
    sizeMB.toFixed(1) +
    " MB"
  );
}

// ==========================================
// ✅ COMMON yt-dlp ARGS
// ==========================================
function commonArgs() {

  const args = [

    "--extractor-args",
    "youtube:player_client=android",

    "--no-playlist",

    "--user-agent",
    "Mozilla/5.0",

    "--quiet",
  ];

  // cookies only if exists
  if (
    fs.existsSync(
      cookiesPath
    )
  ) {

    args.unshift(
      cookiesPath
    );

    args.unshift(
      "--cookies"
    );
  }

  return args;
}

// ==========================================
// ✅ INFO API
// ==========================================
router.post(
  "/info",

  (req, res) => {

    try {

      const url =
        cleanUrl(
          req.body.url
        );

      // validate
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

      // ==========================================
      // ✅ yt-dlp
      // ==========================================
      const yt = spawn(

        "yt-dlp",

        [

          ...commonArgs(),

          "-j",

          url,
        ]
      );

      let data = "";

      yt.stdout.on(
        "data",

        (chunk) => {
          data += chunk;
        }
      );

      yt.stderr.on(
        "data",

        (d) => {

          console.log(
            d.toString()
          );
        }
      );

      yt.on(
        "close",

        (code) => {

          if (
            res.headersSent
          )
            return;

          // failed
          if (
            code !== 0
          ) {

            return res
              .status(500)
              .json({
                error:
                  "Failed to fetch media ❌",
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

            return res
              .status(500)
              .json({
                error:
                  "Parse failed ❌",
              });
          }
        }
      );

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
  }
);

// ==========================================
// ✅ DOWNLOAD API
// ==========================================
router.get(
  "/download",

  (req, res) => {

    try {

      const url =
        cleanUrl(
          req.query.url
        );

      const format =
        req.query.format;

      if (
        !url ||
        !format
      ) {

        return res
          .status(400)
          .json({
            error:
              "Missing data ❌",
          });
      }

      const id =
        crypto
          .randomBytes(6)
          .toString("hex");

      const outputTemplate =
        path.join(

          os.tmpdir(),

          `${id}-%(title).100s.%(ext)s`
        );

      let args = [];

      // ==========================================
      // ✅ MP3
      // ==========================================
      if (
        format.startsWith(
          "mp3-"
        )
      ) {

        args = [

          ...commonArgs(),

          "-f",
          "bestaudio",

          "-x",

          "--audio-format",
          "mp3",

          "--audio-quality",
          "5",

          "-o",
          outputTemplate,

          url,
        ];
      }

      // ==========================================
      // ✅ DIRECT
      // ==========================================
      else {

        args = [

          ...commonArgs(),

          "-f",
          format,

          "-o",
          outputTemplate,

          url,
        ];
      }

      // ==========================================
      // ✅ yt-dlp
      // ==========================================
      const yt = spawn(
        "yt-dlp",
        args
      );

      yt.stderr.on(
        "data",

        (d) => {

          console.log(
            d.toString()
          );
        }
      );

      yt.on(
        "close",

        (code) => {

          if (
            code !== 0
          ) {

            return res
              .status(500)
              .json({
                error:
                  "Download failed ❌",
              });
          }

          fs.readdir(

            os.tmpdir(),

            (
              err,
              files
            ) => {

              if (err) {

                return res
                  .status(500)
                  .json({
                    error:
                      "File error ❌",
                  });
              }

              const file =
                files.find(
                  (f) =>
                    f.startsWith(id)
                );

              if (!file) {

                return res
                  .status(500)
                  .json({
                    error:
                      "File not found ❌",
                  });
              }

              const fullPath =
                path.join(
                  os.tmpdir(),
                  file
                );

              // ==========================================
              // ✅ CLEAN NAME
              // ==========================================
              const cleanName =
                file

                  .replace(
                    /^[a-f0-9]+-/,
                    ""
                  )

                  .replace(
                    /[^\x00-\x7F]/g,
                    ""
                  )

                  .replace(
                    /[<>:"/\\|?*]/g,
                    ""
                  )

                  .trim();

              // ==========================================
              // ✅ HEADER
              // ==========================================
              res.setHeader(

                "x-file-name",

                encodeURIComponent(
                  cleanName
                )
              );

              // ==========================================
              // ✅ SEND
              // ==========================================
              res.sendFile(

                fullPath,

                (err) => {

                  fs.unlink(
                    fullPath,
                    () => {}
                  );

                  if (err) {

                    console.log(
                      err
                    );
                  }
                }
              );
            }
          );
        }
      );

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
  }
);

module.exports = router;
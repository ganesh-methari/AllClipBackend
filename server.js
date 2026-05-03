const express = require("express");
const cors = require("cors");

const mediaRoutes = require("./socialMedia/musicDown");

const app = express();

const allowedOrigins = [
  "https://allclip-3dy2.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked"));
      }
    }
  })
);

app.use(express.json());

app.use("/media", mediaRoutes);

app.get("/", (req, res) => {
  res.send("🎧 Audio Downloader API Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});



// const express = require("express");
// const cors = require("cors");
// const ytdlp = require("yt-dlp-exec");

// const app = express();

// app.use(cors({
//   origin: "https://allclip-3dy2.vercel.app",
//   methods: ["GET", "POST"],
// }));

// app.use(express.json());

// /* ---------------- HEALTH CHECK (IMPORTANT FOR RENDER) ---------------- */
// app.get("/", (req, res) => {
//   res.send("Backend is running 🚀");
// });

// /* ---------------- INFO ROUTE ---------------- */
// app.post("/info", async (req, res) => {
//   const url = req.body.url;

//   console.log("Received URL:", url);

//   if (!url) {
//     return res.status(400).json({ error: "Invalid URL" });
//   }

// try {
//   const ytdlp = require("yt-dlp-exec");

// const data = await ytdlp(url, {
//   dumpSingleJson: true,
//   skipDownload: true,
//   noCheckCertificates: true,
//   noWarnings: true,
//   preferFreeFormats: true,
//   youtubeSkipDashManifest: true,
//   socketTimeout: 15000,
// });

//   res.json({
//     title: data.title,
//     thumbnail: data.thumbnail,
//     duration: data.duration,
//     uploader: data.uploader,
//   });

// } catch (err) {
//   console.error("YT ERROR:", err.message);

//   res.status(500).json({
//     error: "YouTube blocked request or invalid video"
//   });
// }


// });

// /* ---------------- IMPORTANT PORT BINDING ---------------- */
// const PORT = process.env.PORT || 3000;

// app.listen(PORT, "0.0.0.0", () => {
//   console.log("Server running on port " + PORT);
// });

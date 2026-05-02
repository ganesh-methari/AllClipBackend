// const express = require("express");
// const cors = require("cors");

// const musicRoutes = require("./socialMedia/musicDown");
// const videoRoutes = require("./socialMedia/videoDown");

// const app = express();

// app.use(cors());
// app.use(express.json());

// app.use("/media", musicRoutes);   // audio
// app.use("/video", videoRoutes);   // video

// app.listen(5000, () => {
//   console.log("✅ Server running on http://localhost:5000");
// });




const express = require("express");
const cors = require("cors");
const ytdlp = require("yt-dlp-exec");

const app = express();

app.use(cors({
  origin: "https://allclip-3dy2.vercel.app",
  methods: ["GET", "POST"],
}));

app.use(express.json());

/* ---------------- HEALTH CHECK (IMPORTANT FOR RENDER) ---------------- */
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* ---------------- INFO ROUTE ---------------- */
app.post("/info", async (req, res) => {
  const url = req.body.url;

  console.log("Received URL:", url);

  if (!url) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const ytdlp = require("yt-dlp-exec");

    const data = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      quiet: true,
      socketTimeout: 20000,
    });

    return res.json({
      title: data.title || "N/A",
      thumbnail: data.thumbnail || "",
      duration: data.duration || 0,
      uploader: data.uploader || "Unknown",
    });

  } catch (err) {
    console.error("ERROR:", err.message);

    return res.status(500).json({
      error: "Failed to fetch video info",
    });
  }
});

/* ---------------- IMPORTANT PORT BINDING ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});

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
const { log } = require("console");
const exFile = require("child_process").execFile;
const app = express();

app.use(cors());
app.use(express.json());

app.post("/info", (req, res) => {
  const url = req.body.url;
  log("Received URL for info:", url);

  if (!url) {
    return res.status(400).json({ error: "Invalid URL" });
  }

    exFile("yt-dlp", ["-j", url], (error, stdout) => {

if (error) {

    return res.status(500);

    }

    const data = JSON.parse(stdout.trim().split("\n")[0]);

    res.json({
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration,
      uploader: data.uploader,
        _type: data._type,
    });
    log("Info retrieved for URL:", data);
  });

});

app.listen(5000, () => {
 console.log("✅ Server running on http://localhost:5000");

}
);

const express = require("express");
const cors = require("cors");
const mediaRoutes = require("./socialMedia/musicDown"); // Import the combined routes

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://allclip-3dy2.vercel.app"
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

app.use("/media", mediaRoutes);

app.get("/", (req, res) => {
  res.send("🚀 API Running");
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
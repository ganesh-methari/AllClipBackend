const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "*",

    exposedHeaders: [
      "x-file-name",
    ],
  })
);

app.use(express.json());

/* ✅ Routes */
app.use(
  "/music",
  require("./socialMedia/musicDown")
);

app.get("/", (req, res) => {
  res.send("Music API Running 💚");
});

app.listen(5000, () => {
  console.log(
    "Server running on 5000 💚"
  );
});
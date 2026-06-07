import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 18266;
const dist = path.join(__dirname, "dist", "public");

app.use(express.static(dist, { maxAge: "1y", immutable: true, index: false }));

app.use((_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Moi serving on ${PORT}`);
});

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Preload every local image asset before React renders — zero perceptible delay.
const LOCAL_IMAGES = [
  "/images/beige.jpg",
  "/images/cashmere.jpg",
  "/images/teal.jpg",
  "/images/white.jpg",
  "/images/white-2.jpg",
  "/images/white-3.jpg",
  "/images/yellow.jpg",
  "/images/light-blue-main.jpg",
  "/images/filmstrip-a.jpg",
  "/images/filmstrip-b.jpg",
  "/images/wavvy-look-1.jpg?v=2",
  "/images/wavvy-look-2.jpg?v=2",
  "/images/wavvy-look-3.jpg?v=2",
  "/images/wavvy-look-4.jpg?v=2",
  "/images/wavvy-look-5.jpg?v=2",
];
for (const src of LOCAL_IMAGES) {
  const img = new Image();
  img.src = src;
}

createRoot(document.getElementById("root")!).render(<App />);

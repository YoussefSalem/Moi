import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 18266;
const BASE_URL = process.env.BASE_URL || "https://buy-moi.com";

// Product image mapping
const PRODUCT_IMAGES = {
  "moi-wavvy-light-blue": "/images/light-blue-main.webp",
  "moi-wavvy-navy": "/images/navi.webp",
  "moi-wavvy-mint": "/images/mint.webp",
  "moi-versa-top-white": "/images/white.webp",
  "moi-versa-top-cashmere": "/images/cashmere.webp",
  "moi-versa-top-beige": "/images/beige.webp",
  "moi-versa-top-yellow": "/images/white.webp",
  "moi-versa-top-teal": "/images/teal.webp",
  "trio-bangles": "/images/bangles.webp",
};

const PRODUCT_DATA = {
  "moi-wavvy": {
    name: "Moi Wavvy",
    description: "The ultimate throw-and-go. Effortless design, Wavy is light, breathable, and made for drifting.",
    price: "899 EGP",
  },
  "moi-versa-top": {
    name: "Moi Versa Top",
    description: "The signature wrap silhouette. Designed to drape beautifully, the Versa Top transitions effortlessly from day to night.",
    price: "1.399 EGP",
  },
  "trio-bangles": {
    name: "Trio Bangles",
    description: "Three slim stacking bangles in a polished finish — worn together or layered freely. Lightweight, adjustable, and crafted to accompany every look.",
    price: "890 EGP",
  },
};

function getProductInfo(handle) {
  const productKey = Object.keys(PRODUCT_DATA).find((key) =>
    handle === key || handle.startsWith(key + "-")
  );
  if (!productKey) return null;
  return { ...PRODUCT_DATA[productKey], handle };
}

function getProductImage(handle) {
  const productKey = Object.keys(PRODUCT_IMAGES).find((key) =>
    handle === key || handle.startsWith(key + "-")
  );
  return productKey ? PRODUCT_IMAGES[productKey] : "/opengraph.jpg";
}

function isValidProduct(handle) {
  const validProducts = {
    "moi-wavvy": ["light-blue", "navy", "mint"],
    "moi-versa-top": ["white", "cashmere", "beige", "yellow", "teal"],
    "trio-bangles": null,
  };

  const matched = Object.keys(validProducts).find(
    (p) => handle === p || handle.startsWith(p + "-")
  );
  if (!matched) return false;
  const validColors = validProducts[matched];
  if (validColors === null) return true;
  const colorSlug = handle.slice(matched.length + 1);
  if (!colorSlug) return true;
  return validColors.includes(colorSlug);
}

const publicDir = path.join(__dirname, "dist", "public");

app.use(express.static(publicDir, { maxAge: "1d" }));

// Catch-all route: serve index.html with dynamic OG tags
app.use((req, res) => {
  const urlPath = req.path;
  let indexHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");

  // Default OG tags
  let ogTitle = "Moi | Premium Versatile Tops & Fashion";
  let ogDescription = "Discover Moi's curated collection of versatile tops, elegant fashion pieces, and statement accessories. Shop premium clothing designed for effortless everyday style.";
  let ogImage = `${BASE_URL}/opengraph.jpg`;
  let ogUrl = `${BASE_URL}${urlPath}`;
  let ogType = "website";
  let twitterTitle = ogTitle;
  let twitterDescription = ogDescription;
  let twitterImage = ogImage;

  // Check if this is a product page
  if (urlPath.startsWith("/products/")) {
    const handle = urlPath.slice("/products/".length);
    if (isValidProduct(handle)) {
      const info = getProductInfo(handle);
      const image = getProductImage(handle);
      if (info) {
        ogTitle = `${info.name} — Moi`;
        ogDescription = info.description;
        twitterTitle = ogTitle;
        twitterDescription = ogDescription;
      }
      ogImage = `${BASE_URL}${image}`;
      twitterImage = ogImage;
      ogType = "product";
    } else {
      ogTitle = "Page Not Found — Moi";
    }
  }

  // Replace OG meta tags — handle both `>` and `/>` endings with optional whitespace
  indexHtml = indexHtml.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${ogTitle}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${ogDescription}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:image" content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${ogImage}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${ogUrl}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:type" content="[^"]*"\s*\/?>/,
    `<meta property="og:type" content="${ogType}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${twitterTitle}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${twitterDescription}" />`
  );
  indexHtml = indexHtml.replace(
    /<meta name="twitter:image" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:image" content="${twitterImage}" />`
  );
  indexHtml = indexHtml.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${ogUrl}" />`
  );

  res.setHeader("Content-Type", "text/html");
  res.send(indexHtml);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Moi server running on port ${PORT}`);
});

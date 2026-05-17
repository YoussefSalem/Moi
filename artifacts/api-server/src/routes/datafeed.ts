import { Router } from "express";

const DOMAIN = "https://buy-moi.com";

interface FeedProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  url: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  brand: string;
  googleProductCategory: string;
  productType: string;
}

const PRODUCTS: FeedProduct[] = [
  {
    id: "moi-wavvy-top",
    title: "Moi Wavvy Top",
    description:
      "The ultimate throw-and-go. Effortless design, Wavvy is light, breathable, and made for drifting. Available in Ivory, Sand, Taupe, Espresso, Brown, White, and Cashmere.",
    price: 1690,
    image: `${DOMAIN}/images/beige.webp`,
    url: `${DOMAIN}/#moi-wavvy`,
    availability: "in stock",
    condition: "new",
    brand: "Moi",
    googleProductCategory: "1604", // Women's Tops
    productType: "Women's Tops > Versatile Tops",
  },
  {
    id: "moi-versa-top",
    title: "Moi Versa Top",
    description:
      "The ultimate throw-and-go. Effortless design, Versa is light, breathable, and made for drifting. Available in Ivory, Sand, Taupe, Espresso, Brown, White, and Cashmere.",
    price: 1690,
    image: `${DOMAIN}/images/white.webp`,
    url: `${DOMAIN}/#moi-versa`,
    availability: "in stock",
    condition: "new",
    brand: "Moi",
    googleProductCategory: "1604",
    productType: "Women's Tops > Versatile Tops",
  },
  {
    id: "trio-bangles",
    title: "Trio Bangles",
    description:
      "Three slim stacking bangles in a polished finish — worn together or layered freely. Lightweight, adjustable, and crafted to accompany every look.",
    price: 890,
    image: `${DOMAIN}/images/beige.webp`,
    url: `${DOMAIN}/accessories#trio-bangles`,
    availability: "in stock",
    condition: "new",
    brand: "Moi",
    googleProductCategory: "188", // Jewelry > Bracelets
    productType: "Accessories > Bracelets > Bangles",
  },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default function datafeedRouter(): Router {
  const router = Router();

  router.get("/datafeed.xml", (_req, res) => {
    const items = PRODUCTS.map(
      (p) => `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.title)}</g:title>
      <g:description>${escapeXml(p.description)}</g:description>
      <g:link>${escapeXml(p.url)}</g:link>
      <g:image_link>${escapeXml(p.image)}</g:image_link>
      <g:condition>${escapeXml(p.condition)}</g:condition>
      <g:availability>${escapeXml(p.availability)}</g:availability>
      <g:price>${p.price.toFixed(2)} EGP</g:price>
      <g:brand>${escapeXml(p.brand)}</g:brand>
      <g:google_product_category>${escapeXml(p.googleProductCategory)}</g:google_product_category>
      <g:product_type>${escapeXml(p.productType)}</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Moi — Product Feed</title>
    <link>${DOMAIN}</link>
    <description>Premium versatile tops and fashion accessories in Egypt</description>
${items}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(xml);
  });

  return router;
}

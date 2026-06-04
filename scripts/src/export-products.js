/**
 * export-products.js
 * Phase 6 — Data Migration Script
 *
 * Exports all Moi products from the static config file to a Shopify-compatible
 * CSV that can be imported via Shopify Admin → Products → Import.
 *
 * Usage:
 *   node scripts/src/export-products.js
 *
 * Output:
 *   exports/products.csv
 *
 * Shopify CSV columns (matching Shopify's official product import format):
 *   Handle, Title, Body (HTML), Vendor, Type, Tags, Published,
 *   Option1 Name, Option1 Value, Option2 Name, Option2 Value,
 *   Variant Price, Variant Compare At Price, Variant SKU,
 *   Variant Inventory Qty, Variant Inventory Policy,
 *   Variant Fulfillment Service, Variant Requires Shipping,
 *   Variant Taxable, Image Src, Image Position, Image Alt Text,
 *   Gift Card, SEO Title, SEO Description, Status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Product data (mirrored from src/config/images.ts) ────────────────────────
// Because this script runs in Node.js outside the Vite build, we replicate
// the product config here. Update this object whenever images.ts changes.

const PRODUCTS = [
  {
    handle: 'moi-wavvy',
    title: 'MOI Wavvy',
    description: '<p>The ultimate throw-and-go. Light, breathable, and made for drifting. The Wavvy is a relaxed, fluid top that moves with you from morning to evening.</p>',
    vendor: 'Moi',
    type: 'Top',
    tags: 'wavvy, summer, top, lightweight',
    price: '690.00',
    compareAtPrice: '',
    colorOption: 'Color',
    colors: [
      { name: 'Light Blue', sku: 'WAVVY-LB-OS', qty: 10 },
      { name: 'Navy',       sku: 'WAVVY-NV-OS', qty: 10 },
      { name: 'Mint',       sku: 'WAVVY-MT-OS', qty: 10 },
    ],
  },
  {
    handle: 'moi-versa-top',
    title: 'MOI Versa Top',
    description: '<p>Effortlessly versatile. A silhouette that moves with you, in every shade of summer. The Versa Top pairs with everything — from casual days to evening occasions.</p>',
    vendor: 'Moi',
    type: 'Top',
    tags: 'versa, summer, top, versatile',
    price: '590.00',
    compareAtPrice: '',
    colorOption: 'Color',
    colors: [
      { name: 'White',    sku: 'VERSA-WH-OS', qty: 10 },
      { name: 'Cashmere', sku: 'VERSA-CS-OS', qty: 10 },
      { name: 'Beige',    sku: 'VERSA-BG-OS', qty: 10 },
      { name: 'Yellow',   sku: 'VERSA-YL-OS', qty: 10 },
      { name: 'Teal',     sku: 'VERSA-TL-OS', qty: 10 },
    ],
  },
  {
    handle: 'trio-bangles',
    title: 'Trio Bangles',
    description: '<p>Curated set of three elegant bangles. Minimal, stackable, and made to mix.</p>',
    vendor: 'Moi',
    type: 'Accessories',
    tags: 'bangles, accessories, jewellery',
    price: '350.00',
    compareAtPrice: '',
    colorOption: null,
    colors: [
      { name: 'Default Title', sku: 'BANGLE-SET-OS', qty: 15 },
    ],
  },
];

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(cols) {
  return cols.map(csvEscape).join(',');
}

// ── Build rows ────────────────────────────────────────────────────────────────

const HEADERS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
  'Variant Price', 'Variant Compare At Price', 'Variant SKU',
  'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Requires Shipping', 'Variant Taxable',
  'Image Src', 'Image Position', 'Image Alt Text',
  'Gift Card', 'SEO Title', 'SEO Description', 'Status',
];

const rows = [HEADERS.join(',')];

for (const product of PRODUCTS) {
  product.colors.forEach((color, idx) => {
    const isFirst = idx === 0;
    const row = [
      product.handle,
      isFirst ? product.title : '',              // Title only on first variant row
      isFirst ? product.description : '',        // Body only on first row
      isFirst ? product.vendor : '',
      isFirst ? product.type : '',
      isFirst ? product.tags : '',
      isFirst ? 'TRUE' : '',                     // Published
      product.colorOption || (isFirst ? 'Title' : ''),  // Option1 Name
      color.name,                                // Option1 Value
      '', '',                                    // Option2 (unused)
      product.price,
      product.compareAtPrice,
      color.sku,
      color.qty,
      'deny',                                    // Inventory policy
      'manual',                                  // Fulfillment service
      'TRUE',                                    // Requires shipping
      'TRUE',                                    // Taxable
      '',                                        // Image Src (add URLs manually)
      isFirst ? '1' : '',
      isFirst ? product.title : '',
      'FALSE',                                   // Gift card
      isFirst ? product.title : '',
      isFirst ? product.description.replace(/<[^>]+>/g, '').slice(0, 160) : '',
      'active',
    ];
    rows.push(csvRow(row));
  });
}

// ── Write output ──────────────────────────────────────────────────────────────

const outputDir = path.join(__dirname, '../../exports');
const outputFile = path.join(outputDir, 'products.csv');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, rows.join('\n'), 'utf8');

console.log('');
console.log('✅  Export complete!');
console.log('   File:  exports/products.csv');
console.log('   Rows:  ' + (rows.length - 1) + ' variant rows across ' + PRODUCTS.length + ' products');
console.log('');
console.log('Next steps:');
console.log('  1. Open Shopify Admin → Products → Import');
console.log('  2. Upload exports/products.csv');
console.log('  3. After import, add product images via Products → [Product] → Media');
console.log('  4. Assign images to the correct colour variants');
console.log('');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHOPIFY PRODUCT SPLIT SCRIPT
 *
 * Reads MOI WAVVY and MOI Versa Top from Shopify Admin, then creates one
 * standalone product per colour variant.  Safe to re-run — skips handles
 * that already exist.
 *
 * Usage (from workspace root):
 *   export VITE_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
 *   export SHOPIFY_ADMIN_API_TOKEN=shpat_...
 *   pnpm --filter @workspace/scripts run split-products
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN ?? "";
const ADMIN_TOKEN  = process.env.SHOPIFY_ADMIN_API_TOKEN ?? process.env.SHOPIFY_ACCESS_TOKEN ?? "";
const API_VERSION  = "2024-04";

if (!STORE_DOMAIN || !ADMIN_TOKEN) {
  console.error("❌  Set VITE_SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN before running.");
  process.exit(1);
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/${path}`, {
    headers: { "X-Shopify-Access-Token": ADMIN_TOKEN },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ADMIN_TOKEN,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface ShopifyAdminProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  tags: string;
  product_type: string;
  vendor: string;
  images: { id: number; src: string; alt: string | null; position: number }[];
  options: { name: string; values: string[] }[];
  variants: {
    id: number;
    title: string;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    price: string;
    sku: string;
    inventory_quantity: number;
  }[];
}

async function listAllProducts(): Promise<ShopifyAdminProduct[]> {
  const all: ShopifyAdminProduct[] = [];
  let url = `products.json?limit=50&fields=id,title,handle,body_html,tags,product_type,vendor,images,options,variants`;
  while (url) {
    const page = await adminGet<{ products: ShopifyAdminProduct[] }>(url);
    all.push(...page.products);
    url = ""; // Shopify pagination via Link header not needed for small stores
  }
  return all;
}

async function handleExists(handle: string): Promise<boolean> {
  try {
    const data = await adminGet<{ product: ShopifyAdminProduct | null }>(`products.json?handle=${handle}`);
    const list = (data as unknown as { products: ShopifyAdminProduct[] }).products;
    return Array.isArray(list) && list.some((p) => p.handle === handle);
  } catch {
    return false;
  }
}

async function createColorProduct(
  parent: ShopifyAdminProduct,
  colorName: string,
  sizeValues: string[],
  newHandle: string,
  newTitle: string,
): Promise<void> {
  if (await handleExists(newHandle)) {
    console.log(`  ⏭  ${newHandle} — already exists, skipping`);
    return;
  }

  const sizeOption = parent.options.find(
    (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre",
  );

  const variants = sizeValues.map((size, idx) => ({
    option1: sizeValues.length > 1 ? size : "One Size",
    price: parent.variants[0]?.price ?? "0.00",
    sku: `${newHandle.toUpperCase()}-${slugify(size).toUpperCase()}`,
    inventory_management: "shopify",
    inventory_quantity: 5,
    position: idx + 1,
  }));

  const newProduct = {
    product: {
      title: newTitle,
      handle: newHandle,
      body_html: parent.body_html,
      vendor: parent.vendor || "Moi",
      product_type: parent.product_type || "Apparel",
      tags: [parent.tags, `color:${slugify(colorName)}`, "moi-color-split"]
        .filter(Boolean)
        .join(", "),
      options: sizeValues.length > 1
        ? [{ name: sizeOption?.name ?? "Size", values: sizeValues }]
        : [{ name: "Size", values: ["One Size"] }],
      variants,
      images: parent.images.map((img) => ({
        src: img.src,
        alt: img.alt ?? `${newTitle}`,
        position: img.position,
      })),
      status: "active",
    },
  };

  const created = await adminPost<{ product: ShopifyAdminProduct }>("products.json", newProduct);
  console.log(`  ✅  Created: "${created.product.title}" (${created.product.handle})`);
}

const SPLIT_CONFIG: {
  titleKeyword: string;
  colors: string[];
  sizes: string[];
  slugBase: string;
  titleBase: string;
}[] = [
  {
    titleKeyword: "wavvy",
    colors: ["Light Blue", "Navy", "Mint"],
    sizes: ["One Size"],
    slugBase: "moi-wavvy",
    titleBase: "MOI WAVVY",
  },
  {
    titleKeyword: "versa",
    colors: ["White", "Cashmere", "Beige", "Yellow", "Teal"],
    sizes: ["Small / Medium", "Large / XL"],
    slugBase: "moi-versa-top",
    titleBase: "MOI Versa Top",
  },
];

async function run() {
  console.log(`\n🛍  Shopify Product Split — ${STORE_DOMAIN}\n`);
  const allProducts = await listAllProducts();
  console.log(`Found ${allProducts.length} products in Shopify.\n`);

  for (const config of SPLIT_CONFIG) {
    const parent = allProducts.find((p) =>
      p.title.toLowerCase().includes(config.titleKeyword),
    );

    if (!parent) {
      console.warn(`⚠️  No product matching "${config.titleKeyword}" found — skipping.`);
      continue;
    }

    console.log(`Processing: "${parent.title}" (${parent.handle})`);

    for (const color of config.colors) {
      const colorSlug = slugify(color);
      const newHandle = `${config.slugBase}-${colorSlug}`;
      const newTitle = `${config.titleBase} – ${color}`;
      await createColorProduct(parent, color, config.sizes, newHandle, newTitle);
    }
    console.log();
  }

  console.log("✅  Done.\n");
}

run().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});

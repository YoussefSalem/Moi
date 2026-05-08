const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined;
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined;

export const SHOPIFY_CONFIGURED = Boolean(STORE_DOMAIN && STOREFRONT_TOKEN);

const ENDPOINT = STORE_DOMAIN
  ? `https://${STORE_DOMAIN}/api/2024-04/graphql.json`
  : "";

async function shopifyFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!SHOPIFY_CONFIGURED) throw new Error("Shopify not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (STOREFRONT_TOKEN) {
    headers["X-Shopify-Storefront-Access-Token"] = STOREFRONT_TOKEN;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  price: { amount: string; currencyCode: string };
}

export interface ShopifyProductOptionValue {
  name: string;
  swatch: { color: string | null } | null;
}

export interface ShopifyProductOption {
  name: string;
  optionValues: ShopifyProductOptionValue[];
}

export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  featuredImage: ShopifyImage | null;
  images: { nodes: ShopifyImage[] };
  variants: { nodes: ShopifyProductVariant[] };
  options: ShopifyProductOption[];
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: { title: string; handle: string; featuredImage: ShopifyImage | null };
    price: { amount: string; currencyCode: string };
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { totalAmount: { amount: string; currencyCode: string } };
  lines: { nodes: ShopifyCartLine[] };
}

const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id handle title description
    featuredImage { url altText }
    images(first: 10) { nodes { url altText } }
    priceRange { minVariantPrice { amount currencyCode } }
    options {
      name
      optionValues {
        name
        swatch { color }
      }
    }
    variants(first: 20) {
      nodes {
        id title availableForSale
        selectedOptions { name value }
        price { amount currencyCode }
      }
    }
  }
`;

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity
    cost { totalAmount { amount currencyCode } }
    lines(first: 50) {
      nodes {
        id quantity
        merchandise {
          ... on ProductVariant {
            id title
            price { amount currencyCode }
            product { title handle featuredImage { url altText } }
          }
        }
      }
    }
  }
`;

export async function getProducts(first = 10): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>(`
    ${PRODUCT_FRAGMENT}
    query GetProducts($first: Int!) {
      products(first: $first) { nodes { ...ProductFields } }
    }
  `, { first });
  return data.products.nodes;
}

export async function getProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const data = await shopifyFetch<{ productByHandle: ShopifyProduct | null }>(`
    ${PRODUCT_FRAGMENT}
    query GetProduct($handle: String!) {
      productByHandle(handle: $handle) { ...ProductFields }
    }
  `, { handle });
  return data.productByHandle;
}

export async function createCart(): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartCreate: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartCreate {
      cartCreate { cart { ...CartFields } }
    }
  `);
  return data.cartCreate.cart;
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const data = await shopifyFetch<{ cart: ShopifyCart | null }>(`
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) { ...CartFields }
    }
  `, { cartId });
  return data.cart;
}

export async function addCartLines(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesAdd: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } }
    }
  `, { cartId, lines });
  return data.cartLinesAdd.cart;
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesRemove: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } }
    }
  `, { cartId, lineIds });
  return data.cartLinesRemove.cart;
}

export async function updateCartLines(
  cartId: string,
  lines: { id: string; quantity: number }[],
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesUpdate: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } }
    }
  `, { cartId, lines });
  return data.cartLinesUpdate.cart;
}

export async function customerCreate(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  acceptsMarketing = false,
): Promise<{ customerId: string } | { error: string }> {
  const data = await shopifyFetch<{
    customerCreate: {
      customer: { id: string } | null;
      customerUserErrors: { message: string }[];
    };
  }>(`
    mutation CustomerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id }
        customerUserErrors { message }
      }
    }
  `, { input: { email, password, firstName, lastName, acceptsMarketing } });

  if (data.customerCreate.customerUserErrors.length) {
    return { error: data.customerCreate.customerUserErrors[0].message };
  }
  return { customerId: data.customerCreate.customer!.id };
}

export async function customerAccessTokenCreate(
  email: string,
  password: string,
): Promise<{ accessToken: string; expiresAt: string } | { error: string }> {
  const data = await shopifyFetch<{
    customerAccessTokenCreate: {
      customerAccessToken: { accessToken: string; expiresAt: string } | null;
      customerUserErrors: { message: string }[];
    };
  }>(`
    mutation CustomerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken { accessToken expiresAt }
        customerUserErrors { message }
      }
    }
  `, { input: { email, password } });

  if (data.customerAccessTokenCreate.customerUserErrors.length) {
    return { error: data.customerAccessTokenCreate.customerUserErrors[0].message };
  }
  const token = data.customerAccessTokenCreate.customerAccessToken;
  if (!token) return { error: "Could not create access token" };
  return { accessToken: token.accessToken, expiresAt: token.expiresAt };
}

export async function getCustomer(
  accessToken: string,
): Promise<{ id: string; firstName: string | null; lastName: string | null; email: string } | null> {
  const data = await shopifyFetch<{
    customer: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  }>(`
    query GetCustomer($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        id firstName lastName email
      }
    }
  `, { customerAccessToken: accessToken });
  return data.customer;
}

export async function subscribeToNewsletter(email: string): Promise<{ success: boolean; error?: string }> {
  const result = await customerCreate(email, crypto.randomUUID() + "Aa1!", undefined, undefined, true);
  if ("error" in result) {
    if (result.error.toLowerCase().includes("already")) {
      return { success: true };
    }
    return { success: false, error: result.error };
  }
  return { success: true };
}

export function formatMoney(amount: string, currencyCode: string): string {
  const num = parseFloat(amount);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currencyCode} ${num.toFixed(2)}`;
  }
}

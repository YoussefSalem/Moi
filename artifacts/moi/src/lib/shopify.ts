const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined;
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined;
const CHECKOUT_DOMAIN = (import.meta.env.VITE_SHOPIFY_CHECKOUT_DOMAIN as string | undefined)
  ?.replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

export const SHOPIFY_CONFIGURED = Boolean(STORE_DOMAIN && STOREFRONT_TOKEN);

// Shopify's Storefront API always returns *.myshopify.com in checkoutUrl, even
// when a custom primary domain is configured. Rewrite to the brand domain so
// shoppers never see the internal myshopify URL.
function normalizeCart(cart: ShopifyCart): ShopifyCart {
  if (!CHECKOUT_DOMAIN || !cart.checkoutUrl) return cart;
  try {
    const url = new URL(cart.checkoutUrl);
    url.hostname = CHECKOUT_DOMAIN;
    return { ...cart, checkoutUrl: url.toString() };
  } catch {
    return cart;
  }
}

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

  if (!res.ok) {
    throw new Error(res.status === 429
      ? "Shopify is temporarily limiting login attempts. Please try again in a moment."
      : `Shopify API error: ${res.status}`);
  }
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    const message = json.errors[0].message;
    throw new Error(
      message.toLowerCase().includes("attempt limit exceeded")
        ? "Shopify is temporarily limiting login attempts. Please try again in a moment."
        : message,
    );
  }
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
  compareAtPrice: { amount: string; currencyCode: string } | null;
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
    image: ShopifyImage | null;
    selectedOptions: { name: string; value: string }[];
    product: { title: string; handle: string; featuredImage: ShopifyImage | null };
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
  };
}

export interface ShopifyCartDiscountCode {
  code: string;
  applicable: boolean;
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    totalAmount: { amount: string; currencyCode: string };
    subtotalAmount: { amount: string; currencyCode: string };
  };
  discountCodes: ShopifyCartDiscountCode[];
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
        compareAtPrice { amount currencyCode }
      }
    }
  }
`;

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity
    cost {
      totalAmount { amount currencyCode }
      subtotalAmount { amount currencyCode }
    }
    discountCodes { code applicable }
    lines(first: 50) {
      nodes {
        id quantity
        merchandise {
          ... on ProductVariant {
            id title
            image { url altText }
            selectedOptions { name value }
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
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
  return normalizeCart(data.cartCreate.cart);
}

export async function createCartWithLines(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartCreate: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartCreateWithLines($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) { cart { ...CartFields } }
    }
  `, { lines });
  return normalizeCart(data.cartCreate.cart);
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const data = await shopifyFetch<{ cart: ShopifyCart | null }>(`
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) { ...CartFields }
    }
  `, { cartId });
  return data.cart ? normalizeCart(data.cart) : null;
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
  return normalizeCart(data.cartLinesAdd.cart);
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesRemove: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } }
    }
  `, { cartId, lineIds });
  return normalizeCart(data.cartLinesRemove.cart);
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
  return normalizeCart(data.cartLinesUpdate.cart);
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

export async function cartDiscountCodesUpdate(
  cartId: string,
  discountCodes: string[],
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartDiscountCodesUpdate: {
      cart: ShopifyCart;
      userErrors: { field: string[]; message: string }[];
    };
  }>(`
    ${CART_FRAGMENT}
    mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `, { cartId, discountCodes });
  if (data.cartDiscountCodesUpdate.userErrors.length) {
    throw new Error(data.cartDiscountCodesUpdate.userErrors[0].message);
  }
  return normalizeCart(data.cartDiscountCodesUpdate.cart);
}

export async function cartBuyerIdentityUpdate(
  cartId: string,
  email: string,
): Promise<ShopifyCart | null> {
  if (!SHOPIFY_CONFIGURED) return null;
  try {
    const data = await shopifyFetch<{
      cartBuyerIdentityUpdate: {
        cart: ShopifyCart;
        userErrors: { field: string[]; message: string }[];
      };
    }>(`
      ${CART_FRAGMENT}
      mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
        cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
          cart { ...CartFields }
          userErrors { field message }
        }
      }
    `, { cartId, buyerIdentity: { email } });
    if (data.cartBuyerIdentityUpdate.userErrors.length) {
      return null;
    }
    return normalizeCart(data.cartBuyerIdentityUpdate.cart);
  } catch {
    return null;
  }
}

export async function subscribeToNewsletter(email: string): Promise<{ success: boolean; delivered: boolean; note?: string; error?: string }> {
  const res = await fetch("/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, delivered: false, error: json.error ?? "Could not subscribe. Please try again." };
  }
  return { success: true, delivered: Boolean(json.delivered), note: json.note };
}

export interface ShopifyCheckout {
  id: string;
  webUrl: string;
  totalPriceV2: { amount: string; currencyCode: string };
  subtotalPriceV2: { amount: string; currencyCode: string };
}

export interface ShopifyCheckoutPayment {
  id: string;
  ready: boolean;
  errorMessage: string | null;
  checkout: {
    id: string;
    completedAt: string | null;
    order: { id: string; orderNumber: number; name: string } | null;
  } | null;
}

const CHECKOUT_FRAGMENT = `
  fragment CheckoutFields on Checkout {
    id webUrl
    totalPriceV2 { amount currencyCode }
    subtotalPriceV2 { amount currencyCode }
  }
`;

export async function checkoutCreate(
  lines: { variantId: string; quantity: number }[],
  discountCode?: string,
): Promise<ShopifyCheckout> {
  const input: Record<string, unknown> = {
    lineItems: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
  };
  if (discountCode) input.discountCodes = [discountCode];

  const data = await shopifyFetch<{
    checkoutCreate: {
      checkout: ShopifyCheckout | null;
      checkoutUserErrors: { code: string; field: string[]; message: string }[];
    };
  }>(`
    ${CHECKOUT_FRAGMENT}
    mutation CheckoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout { ...CheckoutFields }
        checkoutUserErrors { code field message }
      }
    }
  `, { input });

  if (data.checkoutCreate.checkoutUserErrors.length) {
    throw new Error(data.checkoutCreate.checkoutUserErrors[0].message);
  }
  if (!data.checkoutCreate.checkout) {
    throw new Error("Checkout could not be created");
  }
  return data.checkoutCreate.checkout;
}

export async function checkoutCompleteWithTokenizedPayment(
  checkoutId: string,
  payment: {
    billingAddress: {
      firstName?: string;
      lastName?: string;
      address1?: string;
      address2?: string;
      city?: string;
      province?: string;
      zip?: string;
      country?: string;
      phone?: string;
    };
    idempotencyKey: string;
    paymentAmount: { amount: string; currencyCode: string };
    paymentData: string;
    type: "APPLE_PAY";
  },
): Promise<{ paymentId: string | null; orderNumber: number | null; error: string | null }> {
  const data = await shopifyFetch<{
    checkoutCompleteWithTokenizedPaymentV3: {
      checkout: {
        id: string;
        order: { id: string; orderNumber: number; name: string } | null;
      } | null;
      checkoutUserErrors: { code: string; field: string[]; message: string }[];
      payment: { id: string; ready: boolean; errorMessage: string | null } | null;
    };
  }>(`
    mutation CheckoutCompleteV3($checkoutId: ID!, $payment: TokenizedPaymentInputV3!) {
      checkoutCompleteWithTokenizedPaymentV3(checkoutId: $checkoutId, payment: $payment) {
        checkout {
          id
          order { id orderNumber name }
        }
        checkoutUserErrors { code field message }
        payment { id ready errorMessage }
      }
    }
  `, {
    checkoutId,
    payment: {
      billingAddress: payment.billingAddress,
      idempotencyKey: payment.idempotencyKey,
      paymentAmount: payment.paymentAmount,
      paymentData: payment.paymentData,
      type: payment.type,
    },
  });

  const result = data.checkoutCompleteWithTokenizedPaymentV3;
  if (result.checkoutUserErrors.length) {
    return { paymentId: null, orderNumber: null, error: result.checkoutUserErrors[0].message };
  }
  if (result.payment?.errorMessage) {
    return { paymentId: result.payment.id, orderNumber: null, error: result.payment.errorMessage };
  }

  const orderNumber = result.checkout?.order?.orderNumber ?? null;
  return { paymentId: result.payment?.id ?? null, orderNumber, error: null };
}

export async function pollCheckoutPayment(
  checkoutId: string,
  timeoutMs = 15_000,
): Promise<{ orderNumber: number | null; error: string | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await shopifyFetch<{
      node: {
        id: string;
        completedAt: string | null;
        order: { id: string; orderNumber: number; name: string } | null;
      } | null;
    }>(`
      query CheckoutStatus($id: ID!) {
        node(id: $id) {
          ... on Checkout {
            id completedAt
            order { id orderNumber name }
          }
        }
      }
    `, { id: checkoutId });

    const c = data.node;
    if (c?.completedAt) {
      return { orderNumber: c.order?.orderNumber ?? null, error: null };
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return { orderNumber: null, error: "Payment confirmation timed out — check your email for confirmation" };
}

export function formatMoney(amount: string, currencyCode: string): string {
  const num = parseFloat(amount);
  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);
  const parts = [];
  let remaining = whole;
  while (remaining > 0) {
    parts.unshift((remaining % 1000).toString());
    remaining = Math.floor(remaining / 1000);
  }
  // Pad all parts except the first (most significant) to 3 digits
  for (let i = 1; i < parts.length; i++) {
    parts[i] = parts[i].padStart(3, "0");
  }
  const formatted = parts.length ? parts.join(",") : "0";
  return fraction > 0 ? `${formatted}.${fraction.toString().padStart(2, "0")} ${currencyCode}` : `${formatted} ${currencyCode}`;
}

export type PaymentMethod = "cod" | "instapay" | "card" | "wallet" | "apple-pay";
export type Step = "form" | "loading" | "cod-confirm" | "instapay-confirm" | "card-checkout" | "card-confirm";

export interface OrderResult {
  orderNumber: string | number;
  total: string;
  intentId?: string;
  paymobTxnId?: string;
  shopifyOrderId?: number | null;
  shopifyOrderNumber?: number;
  draftOrderId?: number;
  instapayAccount?: string;
  instapayNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items?: Array<{
    id?: string;
    title: string;
    variantTitle?: string | null;
    quantity: number;
    image?: string | null;
    price?: string;
  }>;
}

export interface OrderBreakdown {
  subtotal: number;
  savings: number;
  shippingCost: number;
  freeShipping: boolean;
  fmt: (n: number) => string;
  total?: number;
}

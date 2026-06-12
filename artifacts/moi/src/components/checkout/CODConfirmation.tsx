import { OrderConfirmedScreen } from "./OrderConfirmedScreen";
import type { OrderResult, OrderBreakdown } from "./types";

export function CODConfirmation({ orderResult, onDone, items, breakdown }: {
  orderResult: OrderResult;
  onDone: () => void;
  items: NonNullable<OrderResult["items"]>;
  breakdown: OrderBreakdown;
}) {
  return (
    <OrderConfirmedScreen
      orderResult={orderResult}
      onDone={onDone}
      items={items}
      breakdown={breakdown}
      title="Order Confirmed."
      subtitle="Cash on Delivery"
      message={orderResult.shopifyOrderNumber
        ? <>Your order has been placed for order <strong style={{ color: "#1e1814" }}>#{orderResult.shopifyOrderNumber}</strong>. Our team will contact you shortly to arrange delivery. Total due on arrival: {orderResult.total} EGP.</>
        : `Your order has been placed. Our team will contact you shortly to arrange delivery. Total due on arrival: ${orderResult.total} EGP.`}
      note="A WhatsApp confirmation has been sent to your number."
    />
  );
}

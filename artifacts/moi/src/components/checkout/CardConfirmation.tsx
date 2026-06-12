import { OrderConfirmedScreen } from "./OrderConfirmedScreen";
import type { OrderResult, OrderBreakdown } from "./types";

export function CardConfirmation({
  orderResult,
  onDone,
  items,
  breakdown,
}: {
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
      message={orderResult.shopifyOrderNumber
        ? <>Your payment has been received for order <strong style={{ color: "#1e1814" }}>#{orderResult.shopifyOrderNumber}</strong>. Your order is now being prepared.</>
        : "Your payment has been received and your order is now being prepared."}
      note="You'll receive a WhatsApp message with your order details and tracking update shortly."
    />
  );
}

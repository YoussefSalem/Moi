export function canUseApplePay(): boolean {
  return (
    typeof window !== "undefined" &&
    "ApplePaySession" in window &&
    !!(window.ApplePaySession as { canMakePayments?: () => boolean } | undefined)?.canMakePayments?.()
  );
}

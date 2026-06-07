/**
 * Feature flags — flip these to enable/disable features in production.
 * All flags are safe to change without a code deploy (redeploy on Oxygen is fast).
 */

export const features = {
  /**
   * Apple Pay via Paymob Shopify app.
   * When true, the CartCheckoutButton renders Apple Pay as an accelerated checkout button.
   * Requires Paymob Shopify app to be installed and configured on the store.
   * On Hydrogen/Oxygen, this works natively — no domain verification workaround needed.
   */
  ENABLE_APPLE_PAY: true,

  /**
   * InstaPay Checkout Extension.
   * When true, the InstaPay option is shown inside Shopify checkout.
   * Requires the Checkout UI Extension to be deployed and published.
   */
  ENABLE_INSTAPAY: false,

  /**
   * Cash on Delivery.
   * Enabled via Shopify admin → Payments → Manual payment methods.
   * This flag controls UI messaging — the actual payment method is configured in Shopify.
   */
  ENABLE_COD: true,

  /**
   * TikTok social proof section on the home page.
   */
  ENABLE_TIKTOK_SOCIAL_PROOF: true,

  /**
   * WhatsApp floating button.
   */
  ENABLE_WHATSAPP_BUTTON: true,

  /**
   * Ambassador program application form.
   */
  ENABLE_AMBASSADOR_PAGE: true,

  /**
   * Newsletter subscription.
   * Submits to admin.buy-moi.com/api/newsletter (Express backend).
   */
  ENABLE_NEWSLETTER: true,

  /**
   * Restock / notify-me notifications.
   * Submits to admin.buy-moi.com/api/restock/subscribe (Express backend).
   */
  ENABLE_RESTOCK_NOTIFY: true,

  /**
   * Internal analytics tracking (admin dashboard events).
   * Separate from Meta/TikTok pixel tracking.
   * Set false to reduce PostgreSQL compute.
   */
  ENABLE_INTERNAL_ANALYTICS: false,
} as const;

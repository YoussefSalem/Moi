import { Resend } from "resend";
import { logger } from "./logger";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  _resend = new Resend(apiKey);
  return _resend;
}

function getBrandFrom(): string {
  const raw = (process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev").trim();
  if (raw.includes("<")) return raw;
  return `Moi <${raw}>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const resend = getResend();
  const from = getBrandFrom();
  logger.info({ from, to: params.to, subject: params.subject }, "Sending email via Resend SDK");
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EmailLineItem {
  title: string;
  variant_title?: string | null;
  quantity: number;
  price: string;
}

// ---------------------------------------------------------------------------
// Core email builder
// ---------------------------------------------------------------------------

function buildEmail({
  preheader,
  headline,
  subline,
  bodyHtml,
  orderNumber,
  total,
  paymentLabel,
  address,
  city,
  governorate,
  lineItems,
  statusNote,
  siteUrl = "https://buy-moi.com",
  discountAmount,
  discountCode,
  shippingAmount,
}: {
  preheader: string;
  headline: string;
  subline: string;
  bodyHtml: string;
  orderNumber: number | string;
  total: string;
  paymentLabel: string;
  address: string;
  city: string;
  governorate: string;
  lineItems?: EmailLineItem[];
  statusNote?: string;
  siteUrl?: string;
  discountAmount?: string;
  discountCode?: string;
  shippingAmount?: string;
}): string {
  const itemRows = lineItems && lineItems.length > 0
    ? lineItems.map((item, i) => {
        const variant =
          item.variant_title && item.variant_title !== "Default Title"
            ? `<br /><span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;">${item.variant_title}</span>`
            : "";
        const border = i === 0 ? "" : "border-top:1px solid #ede9e3;";
        return `
        <tr>
          <td style="padding:16px 0;${border}vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;line-height:1.5;font-weight:600;">${item.title}${variant}</p>
                  <p style="margin:5px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a8e82;letter-spacing:0.15em;text-transform:uppercase;">Qty&nbsp;${item.quantity}</p>
                </td>
                <td style="vertical-align:top;text-align:right;padding-left:20px;white-space:nowrap;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:600;">${item.price}&nbsp;EGP</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
      }).join("")
    : "";

  const itemsSection = itemRows
    ? `
    <!-- Items -->
    <tr><td style="padding:0 48px;">
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Your Items</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ede9e3;">
        ${itemRows}
      </table>
    </td></tr>
    <!-- gap -->
    <tr><td style="height:32px;"></td></tr>`
    : "";

  const statusNoteHtml = statusNote
    ? `<tr><td style="padding:0 48px 32px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.9;color:#7a6e64;padding:16px 20px;border:1px solid #ede9e3;border-left:2px solid #c8bfb4;">${statusNote}</p>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Moi</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<!-- Preheader (hidden) -->
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">${preheader}&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- Card -->
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top accent line -->
    <tr><td style="background:#1a1714;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td style="padding:36px 48px 28px;border-bottom:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
              <img src="${siteUrl}/moi-m-logo.png" alt="Moi" width="48" height="48" style="display:block;border:0;" />
            </a>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#9a8e82;">Order&nbsp;#${orderNumber}</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero text -->
    <tr><td style="padding:44px 48px 0;">
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:32px;font-weight:400;color:#1a1714;line-height:1.15;letter-spacing:-0.01em;">${headline}</h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">${subline}</p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:32px 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- Body content -->
    <tr><td style="padding:0 48px;">${bodyHtml}</td></tr>

    <!-- Divider -->
    <tr><td style="padding:32px 48px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- Order details -->
    <tr><td style="padding:32px 48px 0;">
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Order Summary</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${shippingAmount !== undefined ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Subtotal</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${(parseFloat(total) - parseFloat(shippingAmount) + (discountAmount ? parseFloat(discountAmount) : 0)).toFixed(2)}&nbsp;EGP</td>
        </tr>
        ` : ""}
        ${discountAmount ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Discount ${discountCode ? `(${discountCode})` : ""}</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:600;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">-${parseFloat(discountAmount).toFixed(2)}&nbsp;EGP</td>
        </tr>
        ` : ""}
        ${shippingAmount !== undefined ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Shipping</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${parseFloat(shippingAmount) === 0 ? "Free" : `${parseFloat(shippingAmount).toFixed(2)} EGP`}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;font-weight:700;">Total</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${total}&nbsp;EGP</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Payment</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${paymentLabel}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;vertical-align:top;">Deliver to</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;line-height:1.6;">${address}<br />${city}, ${governorate}</td>
        </tr>
      </table>
    </td></tr>

    <!-- gap -->
    <tr><td style="height:36px;"></td></tr>

    ${itemsSection}
    ${statusNoteHtml}

    <!-- CTA -->
    <tr><td style="padding:0 48px 48px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#1a1714;">
            <a href="${siteUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;">
              Continue Shopping
            </a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:28px 48px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">Questions? <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">hello@buy-moi.com</a></p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;line-height:1.6;">
              <a href="${siteUrl}" style="color:#b0a89e;text-decoration:none;letter-spacing:0.12em;">buy-moi.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Bottom accent line -->
    <tr><td style="background:#1a1714;height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>
  <!-- end card -->

</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// COD Order Email
// ---------------------------------------------------------------------------

export function buildCODOrderEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  address: string;
  governorate: string;
  city: string;
  lineItems?: EmailLineItem[];
  discountAmount?: string;
  discountCode?: string;
  shippingAmount?: string;
}): { html: string; text: string } {
  const { orderNumber, customerName, total, address, governorate, city, lineItems, discountAmount, discountCode, shippingAmount } = params;
  const name = customerName ? customerName.split(" ")[0] : "";

  const html = buildEmail({
    preheader: `Your Moi order #${orderNumber} has been placed. Our team will be in touch shortly.`,
    headline: name ? `Thank you,<br />${name}.` : "Thank you.",
    subline: "Your order has been placed and our team will be in touch shortly to arrange delivery. Payment is collected on arrival.",
    bodyHtml: `
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">
        We've also sent a WhatsApp confirmation to your number. Once your order is on its way, you'll receive a tracking update.
      </p>`,
    orderNumber,
    total,
    paymentLabel: "Cash on Delivery",
    address,
    city,
    governorate,
    lineItems,
    statusNote: "Our courier will contact you before delivery to confirm your availability. If you have any questions or need to change your delivery window, reply to this email.",
    discountAmount,
    discountCode,
    shippingAmount,
  });

  const itemsText = lineItems && lineItems.length > 0
    ? "\nItems:\n" + lineItems.map((i) => {
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` \u2014 ${i.variant_title}` : "";
        return `  ${i.title}${v} \u00d7 ${i.quantity}  (${i.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const discountText = discountAmount ? `\nDiscount ${discountCode ? `(${discountCode})` : ""}: -${discountAmount} EGP` : "";
  const shippingText = shippingAmount ? `\nShipping: ${parseFloat(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";

  const text = `Order Placed \u2014 Moi\n\n${name ? `Thank you, ${name}.` : "Thank you."}\n\nYour order has been placed. Our team will be in touch shortly to arrange delivery. Payment is collected on arrival.\n\nOrder #${orderNumber}\n${itemsText}${discountText}${shippingText}\nTotal: ${total} EGP\nPayment: Cash on Delivery\nDeliver to: ${address}, ${city}, ${governorate}\n\nIf you have any questions, contact us at hello@buy-moi.com\n\nbuy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// Card / Paid Order Email
// ---------------------------------------------------------------------------

export function buildOrderConfirmationEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  paymentMethod: string;
  address: string;
  governorate: string;
  city: string;
  lineItems?: EmailLineItem[];
  discountAmount?: string;
  discountCode?: string;
  shippingAmount?: string;
}): { html: string; text: string } {
  const { orderNumber, customerName, total, paymentMethod, address, governorate, city, lineItems, discountAmount, discountCode, shippingAmount } = params;
  const name = customerName ? customerName.split(" ")[0] : "";

  const html = buildEmail({
    preheader: `Your Moi order #${orderNumber} is confirmed. It's now being prepared.`,
    headline: name ? `Order confirmed,<br />${name}.` : "Order confirmed.",
    subline: "Your payment has been received and your order is now being prepared. You'll receive a WhatsApp update with your tracking number once it's on its way.",
    bodyHtml: `
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">
        If you have any questions about your order, simply reply to this email and we'll be happy to help.
      </p>`,
    orderNumber,
    total,
    paymentLabel: paymentMethod,
    address,
    city,
    governorate,
    lineItems,
    discountAmount,
    discountCode,
    shippingAmount,
  });

  const itemsText = lineItems && lineItems.length > 0
    ? "\nItems:\n" + lineItems.map((i) => {
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` \u2014 ${i.variant_title}` : "";
        return `  ${i.title}${v} \u00d7 ${i.quantity}  (${i.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const discountText = discountAmount ? `\nDiscount ${discountCode ? `(${discountCode})` : ""}: -${discountAmount} EGP` : "";
  const shippingText = shippingAmount ? `\nShipping: ${parseFloat(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";

  const text = `Order Confirmed \u2014 Moi\n\n${name ? `Order confirmed, ${name}.` : "Order confirmed."}\n\nYour payment has been received and your order is now being prepared.\n\nOrder #${orderNumber}\n${itemsText}${discountText}${shippingText}\nTotal: ${total} EGP\nPayment: ${paymentMethod}\nDeliver to: ${address}, ${city}, ${governorate}\n\nIf you have any questions, contact us at hello@buy-moi.com\n\nbuy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// InstaPay Pending Email
// ---------------------------------------------------------------------------

export function buildInstapayPendingEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  referenceNumber: string;
  discountAmount?: string;
  discountCode?: string;
  shippingAmount?: string;
}): { html: string; text: string } {
  const { orderNumber, customerName, total, referenceNumber, discountAmount, discountCode, shippingAmount } = params;
  const name = customerName ? customerName.split(" ")[0] : "";
  const siteUrl = "https://buy-moi.com";

  const html = buildEmail({
    preheader: `We've received your InstaPay proof for order #${orderNumber}. Verification is in progress.`,
    headline: "Verifying your<br />payment.",
    subline: "We've received your InstaPay proof and your order is pending payment verification. Our team will review it shortly \u2014 usually within a few hours.",
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">InstaPay Ref</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Status</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#b08d6a;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;letter-spacing:0.08em;text-transform:uppercase;">Pending Verification</td>
        </tr>
      </table>`,
    orderNumber,
    total,
    paymentLabel: "InstaPay Transfer",
    address: "",
    city: "",
    governorate: "",
    statusNote: "Once your transfer is verified, you'll receive a WhatsApp confirmation and your order will be dispatched. If you have any questions, simply reply to this email.",
    siteUrl,
    discountAmount,
    discountCode,
    shippingAmount,
  });

  const discountText = discountAmount ? `\nDiscount ${discountCode ? `(${discountCode})` : ""}: -${discountAmount} EGP` : "";
  const shippingText = shippingAmount ? `\nShipping: ${parseFloat(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";

  const text = `Payment Verification in Progress \u2014 Moi\n\n${name ? `Hi ${name},` : "Hello,"}\n\nWe've received your InstaPay proof for order #${orderNumber}.\n\nOrder #${orderNumber}${discountText}${shippingText}\nTotal: ${total} EGP\nInstaPay Ref: ${referenceNumber}\nStatus: Pending Verification\n\nOnce verified, you'll receive a WhatsApp confirmation and your order will be dispatched.\n\nbuy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// Abandoned Cart Recovery Email
// ---------------------------------------------------------------------------

export function buildAbandonedCartEmail(params: {
  customerEmail: string;
  lineItems: Array<{
    title: string;
    variant?: string;
    quantity: number;
    price: string;
    imageUrl?: string;
  }>;
  totalAmount: string;
  recoveryUrl: string;
  siteUrl?: string;
}): { html: string; text: string } {
  const { lineItems, totalAmount, recoveryUrl, siteUrl = "https://buy-moi.com" } = params;

  // Build each product row \u2014 mobile-first, using only real product images from the cart
  const itemRows = lineItems.map((item, i) => {
    const hasImage = !!item.imageUrl;
    const imgSection = hasImage
      ? `<div style="margin-bottom:10px;min-width:100px;">
          <img src="${item.imageUrl}" alt="${item.title}" style="display:block;width:100%;max-width:120px;height:auto;border:0;object-fit:cover;border-radius:2px;" />
        </div>`
      : "";

    const variant = item.variant && item.variant !== "Default Title"
      ? `<span style="display:inline-block;margin-top:4px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#9a8e82;font-weight:600;">${item.variant}</span>`
      : "";

    return `
    <div style="padding:18px 0;${i === 0 ? "" : "border-top:1px solid #ede9e3;"}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;padding-right:16px;" width="120">
            ${imgSection}
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#1a1714;line-height:1.4;font-weight:700;">${item.title}</p>${variant}
            <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a8e82;">Qty: ${item.quantity}</p>
            <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#1a1714;font-weight:700;">${item.price.replace(/\s*EGP\s*/i, "").trim()}&nbsp;EGP</p>
          </td>
        </tr>
      </table>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<meta name="color-scheme" content="light" />
<title>You left something behind \u2014 Moi</title>
<style>
  /* Reset */
  body,table,td,p,a,li,blockquote{ -webkit-text-size-adjust:none; -ms-text-size-adjust:none; }
  table,td{mso-table-lspace:0;mso-table-rspace:0;border-collapse:collapse;}
  img{ -ms-interpolation-mode:bicubic; display:block; max-width:100%; height:auto; border:0; }
  a{text-decoration:none;}
  /* Mobile-first */
  @media only screen and (max-width: 480px) {
    .wrapper{padding:20px 12px !important;}
    .card{padding:28px 20px !important;}
    .hero-title{font-size:24px !important; line-height:1.2 !important;}
    .hero-sub{font-size:15px !important;}
    .cta-btn{display:block !important; text-align:center !important; padding:22px 32px !important; font-size:13px !important;}
    .item-title{font-size:15px !important;}
    .item-price{font-size:15px !important;}
  }
</style>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f0eb;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<!-- Hidden preheader (blank so phone notification shows only the subject) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  &nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<!-- Wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f0eb;">
  <tr>
    <td align="center" class="wrapper" style="padding:32px 16px 96px;">

      <!-- Card: max 460px for mobile-first, centered -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;background:#ffffff;border-radius:4px;">

        <!-- Top accent -->
        <tr><td style="background:#1a1714;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Brand bar -->
        <tr><td class="card" style="padding:24px 24px 20px;border-bottom:1px solid #ede9e3;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <a href="${siteUrl}" style="text-decoration:none;">
                  <img src="${siteUrl}/moi-m-logo.png" alt="MOI" width="44" height="44" style="display:block;border:0;" />
                </a>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#b0a89e;">New Collection</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Hero copy -->
        <tr><td class="card" style="padding:32px 24px 0;">
          <h1 class="hero-title" style="margin:0 0 10px;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;font-weight:400;color:#1a1714;line-height:1.25;letter-spacing:-0.01em;">Our MOI pieces are waiting for you.</h1>
          <p class="hero-sub" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#5c504a;">Complete your wardrobe before they sell out.</p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:24px 24px;"><div style="border-top:1px solid #ede9e3;height:0;">&nbsp;</div></td></tr>

        <!-- Product list -->
        <tr><td class="card" style="padding:0 24px;">
          <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#9a8e82;font-weight:700;">YOUR CART</p>
          ${itemRows}
        </td></tr>

        <!-- Spacer -->
        <tr><td style="height:16px;">&nbsp;</td></tr>

        <!-- CTA (centered) -->
        <tr><td class="card" style="padding:0 24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" style="background:#1a1714;border-radius:50px;">
                  <tr>
                    <td>
                      <a href="${recoveryUrl}" class="cta-btn" style="display:inline-block;padding:22px 80px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;">
                        Complete My Order
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Socials + Footer -->
        <tr><td style="padding:24px 24px 16px;border-top:1px solid #ede9e3;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a8e82;line-height:1.6;text-align:center;">
                  Questions? Contact us at <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;font-weight:600;">hello@buy-moi.com</a>
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
                  <tr>
                    <td style="padding:0 12px;">
                      <a href="https://www.instagram.com/shopmoi___" target="_blank" style="text-decoration:none;">
                        <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%231a1714%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%222%22%20y%3D%222%22%20width%3D%2220%22%20height%3D%2220%22%20rx%3D%225%22%20ry%3D%225%22%2F%3E%3Cpath%20d%3D%22M16%2011.37A4%204%200%201%201%2012.63%208%204%204%200%200%201%2016%2011.37z%22%2F%3E%3Cline%20x1%3D%2217.5%22%20y1%3D%226.5%22%20x2%3D%2217.51%22%20y2%3D%226.5%22%2F%3E%3C%2Fsvg%3E" alt="Instagram" width="24" height="24" style="display:block;border:0;" />
                      </a>
                    </td>
                    <td style="padding:0 12px;">
                      <a href="https://www.tiktok.com/@shopmoi_" target="_blank" style="text-decoration:none;">
                        <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%231a1714%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M9%2012a4%204%200%201%200%204%204V4a5%205%200%200%200%205%205%22%2F%3E%3C%2Fsvg%3E" alt="TikTok" width="24" height="24" style="display:block;border:0;" />
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.55em;text-transform:uppercase;color:#1a1714;text-align:center;">M O I</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;text-align:center;">Effortless. Versatile. Yours.</p>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;text-align:center;">
                  <a href="${siteUrl}" style="color:#b0a89e;text-decoration:none;letter-spacing:0.1em;">buy-moi.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Bottom accent -->
        <tr><td style="background:#1a1714;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- End spacer -->
        <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

      </table>
      <!-- end card -->

    </td>
  </tr>
</table>
</body>
</html>`;

  const itemsText = lineItems.map((i) => {
    const v = i.variant && i.variant !== "Default Title" ? ` \u2014 ${i.variant}` : "";
    return `  ${i.title}${v} x ${i.quantity}  (${i.price} EGP)`;
  }).join("\n");

  const text = `Our MOI pieces are waiting for you.\n\nComplete your wardrobe before they sell out.\n\nYOUR CART:\n${itemsText}\n\nComplete My Order:\n${recoveryUrl}\n\nQuestions? Contact us at hello@buy-moi.com\nInstagram: https://www.instagram.com/shopmoi___\nTikTok: https://www.tiktok.com/@shopmoi_\n\nbuy-moi.com`;

  return { html, text };
}

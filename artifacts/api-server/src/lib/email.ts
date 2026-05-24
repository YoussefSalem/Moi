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
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

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
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` — ${i.variant_title}` : "";
        return `  ${i.title}${v} × ${i.quantity}  (${i.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const discountText = discountAmount ? `\nDiscount ${discountCode ? `(${discountCode})` : ""}: -${discountAmount} EGP` : "";
  const shippingText = shippingAmount ? `\nShipping: ${parseFloat(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";

  const text = `Order Placed — Moi\n\n${name ? `Thank you, ${name}.` : "Thank you."}\n\nYour order has been placed. Our team will be in touch shortly to arrange delivery. Payment is collected on arrival.\n\nOrder #${orderNumber}\n${itemsText}${discountText}${shippingText}\nTotal: ${total} EGP\nPayment: Cash on Delivery\nDeliver to: ${address}, ${city}, ${governorate}\n\nIf you have any questions, contact us at hello@buy-moi.com\n\nbuy-moi.com`;

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
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` — ${i.variant_title}` : "";
        return `  ${i.title}${v} × ${i.quantity}  (${i.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const discountText = discountAmount ? `\nDiscount ${discountCode ? `(${discountCode})` : ""}: -${discountAmount} EGP` : "";
  const shippingText = shippingAmount ? `\nShipping: ${parseFloat(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";

  const text = `Order Confirmed — Moi\n\n${name ? `Order confirmed, ${name}.` : "Order confirmed."}\n\nYour payment has been received and your order is now being prepared.\n\nOrder #${orderNumber}\n${itemsText}${discountText}${shippingText}\nTotal: ${total} EGP\nPayment: ${paymentMethod}\nDeliver to: ${address}, ${city}, ${governorate}\n\nIf you have any questions, contact us at hello@buy-moi.com\n\nbuy-moi.com`;

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
    subline: "We've received your InstaPay proof and your order is pending payment verification. Our team will review it shortly — usually within a few hours.",
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

  const text = `Payment Verification in Progress — Moi\n\n${name ? `Hi ${name},` : "Hello,"}\n\nWe've received your InstaPay proof for order #${orderNumber}.\n\nOrder #${orderNumber}${discountText}${shippingText}\nTotal: ${total} EGP\nInstaPay Ref: ${referenceNumber}\nStatus: Pending Verification\n\nOnce verified, you'll receive a WhatsApp confirmation and your order will be dispatched.\n\nbuy-moi.com`;

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
  const { customerEmail, lineItems, totalAmount, recoveryUrl, siteUrl = "https://buy-moi.com" } = params;
  const firstName = customerEmail.split("@")[0];

  const itemRows = lineItems.map((item, i) => {
    const variant = item.variant && item.variant !== "Default Title"
      ? `<br /><span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;">${item.variant}</span>`
      : "";
    const border = i === 0 ? "" : "border-top:1px solid #ede9e3;";
    const imageCell = item.imageUrl
      ? `<td style="width:72px;padding-right:16px;vertical-align:top;">
          <img src="${item.imageUrl}" alt="${item.title}" width="72" height="96" style="display:block;border:0;object-fit:cover;" />
        </td>`
      : "";
    return `
    <tr>
      ${imageCell}
      <td style="padding:16px 0;${border}vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1714;line-height:1.5;font-weight:600;">${item.title}${variant}</p>
              <p style="margin:5px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a8e82;letter-spacing:0.15em;text-transform:uppercase;">Qty&nbsp;${item.quantity}</p>
            </td>
            <td style="vertical-align:top;text-align:right;padding-left:20px;white-space:nowrap;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1714;font-weight:600;">${item.price}&nbsp;EGP</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Your cart is waiting — Moi</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<!-- Preheader (hidden) -->
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">You left something beautiful behind. Complete your order in one click. &nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;</div>

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
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#9a8e82;">New Collection</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero text -->
    <tr><td style="padding:44px 48px 0;">
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:32px;font-weight:400;color:#1a1714;line-height:1.15;letter-spacing:-0.01em;">${firstName ? `${firstName}, you left something behind.` : "You left something behind."}</h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">Your cart is saved and waiting. These pieces are moving fast — complete your order now before they're gone.</p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:32px 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- Items -->
    <tr><td style="padding:0 48px;">
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Your Cart</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ede9e3;">
        ${itemRows}
      </table>
    </td></tr>

    <!-- gap -->
    <tr><td style="height:24px;"></td></tr>

    <!-- Total + CTA -->
    <tr><td style="padding:0 48px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1714;font-weight:700;letter-spacing:0.05em;">Total</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#1a1714;font-weight:700;text-align:right;">${totalAmount}&nbsp;EGP</td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:32px;">
        <tr>
          <td style="background:#1a1714;">
            <a href="${recoveryUrl}" style="display:inline-block;padding:16px 40px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;">
              Complete My Order
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a8e82;line-height:1.6;">Questions? Reply to this email or contact us at <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">hello@buy-moi.com</a></p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:28px 48px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">Effortless. Versatile. Yours.</p>
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

  const itemsText = lineItems.map((i) => {
    const v = i.variant && i.variant !== "Default Title" ? ` — ${i.variant}` : "";
    return `  ${i.title}${v} \u00d7 ${i.quantity}  (${i.price} EGP)`;
  }).join("\n");

  const text = `${firstName ? `Hi ${firstName},` : "Hello,"}\n\nYou left something beautiful behind.\n\nYour cart:\n${itemsText}\n\nTotal: ${totalAmount} EGP\n\nComplete your order here:\n${recoveryUrl}\n\nThese pieces are moving fast — don't wait too long.\n\nQuestions? Contact us at hello@buy-moi.com\n\nbuy-moi.com`;

  return { html, text };
}

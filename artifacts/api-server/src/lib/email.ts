import { Resend } from "resend";
import { logger } from "./logger";
import { parseEGP } from "@workspace/utils";
import { getSiteUrl } from "./siteUrl";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_CHECKOUT_KEY ?? process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_CHECKOUT_KEY or RESEND_API_KEY not configured");
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
  imageUrl?: string | null;
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
  footerHtml,
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
  footerHtml?: string;
}): string {
  const itemRows = lineItems && lineItems.length > 0
    ? lineItems.map((item, i) => {
        const variant =
          item.variant_title && item.variant_title !== "Default Title"
            ? `<br /><span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;">${item.variant_title}</span>`
            : "";
        const border = i === 0 ? "" : "border-top:1px solid #ede9e3;";
        const imageCell = item.imageUrl
          ? `<td style="vertical-align:top;width:72px;padding-right:16px;">
                <img src="${item.imageUrl}" alt="${item.title}" width="72" height="72" style="display:block;border:0;border-radius:4px;object-fit:cover;" />
              </td>`
          : "";
        return `
        <tr>
          <td style="padding:16px 0;${border}vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${imageCell}
                <td style="vertical-align:top;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;line-height:1.5;font-weight:600;">${item.title}${variant}</p>
                  <p style="margin:5px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a8e82;letter-spacing:0.15em;text-transform:uppercase;">Qty&nbsp;${item.quantity}</p>
                </td>
                <td style="vertical-align:top;text-align:right;padding-left:20px;white-space:nowrap;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:600;">${item.price.replace(/\s*EGP\s*/i, "").trim()}&nbsp;EGP</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
      }).join("")
    : "";

  // Subtotal = sum of line item prices (not derived from total, which may not match)
  const lineItemsSubtotal = lineItems && lineItems.length > 0
    ? lineItems.reduce((sum, item) => {
        const price = parseEGP(item.price) || 0;
        return sum + price * item.quantity;
      }, 0)
    : (shippingAmount !== undefined
        ? parseEGP(total) - parseEGP(shippingAmount) + (discountAmount ? parseEGP(discountAmount) : 0)
        : parseEGP(total));

  // Compute correct email total from components so it always matches the math shown
  const shippingNum = shippingAmount !== undefined ? parseEGP(shippingAmount) : 0;
  const discountNum = discountAmount ? parseEGP(discountAmount) : 0;
  const emailTotal = (lineItemsSubtotal - discountNum + shippingNum).toFixed(2);

  const itemsSection = itemRows
    ? `
    <!-- gap before items -->
    <tr><td style="height:32px;"></td></tr>
    <!-- Items -->
    <tr><td style="padding:0 48px;">
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Your Items</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ede9e3;">
        ${itemRows}
      </table>
    </td></tr>
    <!-- gap after items -->
    <tr><td style="height:24px;"></td></tr>`
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

    ${itemsSection}

    <!-- Order details -->
    <tr><td style="padding:32px 48px 0;">
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Order Summary</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${shippingAmount !== undefined ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Subtotal</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${lineItemsSubtotal.toFixed(2)}&nbsp;EGP</td>
        </tr>
        ` : ""}
        ${discountAmount ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Discount ${discountCode ? `(${discountCode})` : ""}</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:600;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">-${parseEGP(discountAmount).toFixed(2)}&nbsp;EGP</td>
        </tr>
        ` : ""}
        ${shippingAmount !== undefined ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Shipping</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${parseEGP(shippingAmount) === 0 ? "Free" : `${parseEGP(shippingAmount).toFixed(2)} EGP`}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;font-weight:700;">Total to pay</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${emailTotal}&nbsp;EGP</td>
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
    <tr><td style="height:24px;"></td></tr>

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

    ${footerHtml ?? `
    <!-- Footer -->
    <tr><td style="padding:28px 48px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#5c504a;">XoXo, Moi.&#x1F48B;</p>
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
    `}

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
  const shippingText = shippingAmount ? `\nShipping: ${parseEGP(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";
  const lineSubtotalText = lineItems && lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + (parseEGP(item.price) || 0) * item.quantity, 0)
    : (parseEGP(total) - parseEGP(shippingAmount ?? "0") + (discountAmount ? parseEGP(discountAmount) : 0));
  const emailTotalText = (lineSubtotalText - (discountAmount ? parseEGP(discountAmount) : 0) + parseEGP(shippingAmount ?? "0")).toFixed(2);

  const text = `Order Placed \u2014 Moi\n\n${name ? `Thank you, ${name}.` : "Thank you."}\n\nYour order has been placed. Our team will be in touch shortly to arrange delivery. Payment is collected on arrival.\n\nOrder #${orderNumber}\n${itemsText}${discountText}${shippingText}\nTotal: ${emailTotalText} EGP\nPayment: Cash on Delivery\nDeliver to: ${address}, ${city}, ${governorate}\n\nIf you have any questions, contact us at hello@buy-moi.com\n\nXoXo, Moi.\uD83D\uDC8B\n\nbuy-moi.com`;

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
  const shippingText = shippingAmount ? `\nShipping: ${parseEGP(shippingAmount) === 0 ? "Free" : `${shippingAmount} EGP`}` : "";
  const lineSubtotalText2 = lineItems && lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + (parseEGP(item.price) || 0) * item.quantity, 0)
    : (parseEGP(total) - parseEGP(shippingAmount ?? "0") + (discountAmount ? parseEGP(discountAmount) : 0));
  const emailTotalText2 = (lineSubtotalText2 - (discountAmount ? parseEGP(discountAmount) : 0) + parseEGP(shippingAmount ?? "0")).toFixed(2);

  const text = `Order Confirmed \u2014 Moi\n\n${name ? `Order confirmed, ${name}.` : "Order confirmed."}\n\nYour payment has been received and your order is now being prepared.\n\nOrder #${orderNumber}\n${itemsText}${discountText}${shippingText}\nTotal: ${emailTotalText2} EGP\nPayment: ${paymentMethod}\nDeliver to: ${address}, ${city}, ${governorate}\n\nIf you have any questions, contact us at hello@buy-moi.com\n\nXoXo, Moi.\uD83D\uDC8B\n\nbuy-moi.com`;

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
  const shippingAmountNum3 = parseEGP(shippingAmount ?? "0");
  const shippingText = shippingAmount ? `\nShipping: ${shippingAmountNum3 === 0 ? "Free" : `${shippingAmount} EGP`}` : "";
  const emailTotalText3 = parseEGP(total).toFixed(2);

  const text = `Payment Verification in Progress \u2014 Moi\n\n${name ? `Hi ${name},` : "Hello,"}\n\nWe've received your InstaPay proof for order #${orderNumber}.\n\nOrder #${orderNumber}${discountText}${shippingText}\nTotal: ${emailTotalText3} EGP\nInstaPay Ref: ${referenceNumber}\nStatus: Pending Verification\n\nOnce verified, you'll receive a WhatsApp confirmation and your order will be dispatched.\n\nXoXo, Moi.\uD83D\uDC8B\n\nbuy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// InstaPay Confirmed Email (admin approved)
// ---------------------------------------------------------------------------

export function buildInstapayConfirmedEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  referenceNumber: string;
  address: string;
  city: string;
  governorate: string;
  discountAmount?: string;
  discountCode?: string;
  shippingAmount?: string;
}): { html: string; text: string } {
  const { orderNumber, customerName, total, referenceNumber, address, city, governorate, discountAmount, discountCode, shippingAmount } = params;
  const name = customerName ? customerName.split(" ")[0] : "";
  const siteUrl = "https://buy-moi.com";

  const html = buildEmail({
    preheader: `Your Moi order #${orderNumber} has been confirmed. Payment verified and order being prepared.`,
    headline: name ? `Thank you,<br />${name}.` : "Thank you.",
    subline: "Your payment has been successfully confirmed and your order is now being prepared. You'll receive a WhatsApp tracking update once it's on its way.",
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">InstaPay Ref</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Status</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;letter-spacing:0.08em;text-transform:uppercase;">Payment Confirmed — Order Being Prepared</td>
        </tr>
      </table>`,
    orderNumber,
    total,
    paymentLabel: "InstaPay Transfer",
    address,
    city,
    governorate,
    statusNote: "Our team is packing your order right now. You'll receive a WhatsApp message with your Bosta tracking number once it leaves our studio.",
    siteUrl,
    discountAmount,
    discountCode,
    shippingAmount,
  });

  const discountText = discountAmount ? `\nDiscount ${discountCode ? `(${discountCode})` : ""}: -${discountAmount} EGP` : "";
  const shippingAmountNum4 = parseEGP(shippingAmount ?? "0");
  const shippingText = shippingAmount ? `\nShipping: ${shippingAmountNum4 === 0 ? "Free" : `${shippingAmount} EGP`}` : "";
  const emailTotalText4 = parseEGP(total).toFixed(2);

  const text = `Payment Confirmed — Moi\n\n${name ? `Thank you, ${name}.` : "Thank you."}\n\nYour payment has been successfully confirmed and your order is now being prepared.\n\nOrder #${orderNumber}${discountText}${shippingText}\nTotal: ${emailTotalText4} EGP\nInstaPay Ref: ${referenceNumber}\nStatus: Payment Confirmed — Order Being Prepared\nDeliver to: ${address}, ${city}, ${governorate}\n\nOur team is packing your order right now. You'll receive a WhatsApp message with your Bosta tracking number once it leaves our studio.\n\nQuestions? hello@buy-moi.com\n\nXoXo, Moi.\uD83D\uDC8B\n\nbuy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// InstaPay Admin Reference Email — sent to admin when proof is submitted
// ---------------------------------------------------------------------------

export function buildInstapayAdminReferenceEmail(params: {
  draftOrderId: number | string;
  customerName: string;
  customerPhone: string;
  referenceNumber: string;
  amount: string;
}): { html: string; text: string } {
  const { draftOrderId, customerName, customerPhone, referenceNumber, amount } = params;
  const siteUrl = "https://buy-moi.com";
  const adminUrl = `${siteUrl}/admin`;
  const igLink = "https://www.instagram.com/shopmoi/";
  const tiktokLink = "https://www.tiktok.com/@shopmoi___";

  const html = `<!DOCTYPE html>
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
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">New InstaPay proof submitted — Draft #${draftOrderId}. Admin reference.&nbsp;​&nbsp;​&nbsp;​&nbsp;​&nbsp;​&nbsp;​&nbsp;​&nbsp;​&nbsp;​&nbsp;​</div>

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
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#9a8e82;">Draft Order&nbsp;#${draftOrderId}</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero text -->
    <tr><td style="padding:44px 48px 0;">
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:32px;font-weight:400;color:#1a1714;line-height:1.15;letter-spacing:-0.01em;">New InstaPay<br />Proof Submitted.</h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">This is a reference for the admin. Keep this email in case a customer contacts you about this draft order.</p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:32px 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- Details -->
    <tr><td style="padding:0 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Draft Order</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">#${draftOrderId}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Customer</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:600;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${customerName || "N/A"}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Phone</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:600;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${customerPhone || "N/A"}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">InstaPay Ref</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Amount</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${amount}&nbsp;EGP</td>
        </tr>
      </table>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:32px 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- CTA -->
    <tr><td style="padding:0 48px 48px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#1a1714;">
            <a href="${adminUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;">
              Review in Admin
            </a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Footer with social links -->
    <tr><td style="padding:28px 48px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">Questions? <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">hello@buy-moi.com</a></p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">Instagram: <a href="${igLink}" style="color:#1a1714;text-decoration:underline;">@shopmoi</a></p>
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

  const text = `ADMIN REFERENCE — InstaPay Proof

Draft Order: #${draftOrderId}
Customer: ${customerName || "N/A"}
Phone: ${customerPhone || "N/A"}
InstaPay Ref: ${referenceNumber}
Amount: ${amount} EGP

Review in Admin: ${adminUrl}

Questions? hello@buy-moi.com
Instagram: @shopmoi (${igLink})

buy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// InstaPay Rejected Email (admin rejected)
// ---------------------------------------------------------------------------

export function buildInstapayRejectedEmail(params: {
  draftOrderId: number | string;
  customerName: string;
  total: string;
  referenceNumber: string;
  rejectionReason?: string | null;
}): { html: string; text: string } {
  const { draftOrderId, customerName, total, referenceNumber, rejectionReason } = params;
  const name = customerName ? customerName.split(" ")[0] : "";
  const siteUrl = "https://buy-moi.com";

  const reasonLine = rejectionReason
    ? `<tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Reason</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">${rejectionReason}</td>
        </tr>`
    : "";

  const reasonText = rejectionReason ? `\nReason: ${rejectionReason}` : "";

  const html = buildEmail({
    preheader: `We could not confirm your payment for Draft Order #${draftOrderId}. Contact us for assistance.`,
    headline: name ? `We're sorry,<br />${name}.` : "We're sorry.",
    subline: "We were unable to confirm your payment. Your order has been cancelled. If you need any help, please contact us and we'll assist you as soon as possible.",
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Draft Order</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;">#${draftOrderId}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">InstaPay Ref</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8e82;padding:11px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Status</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#b08d6a;font-weight:700;padding:11px 0;border-top:1px solid #ede9e3;text-align:right;letter-spacing:0.08em;text-transform:uppercase;">Payment Not Confirmed</td>
        </tr>
        ${reasonLine}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr><td style="padding:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Get In Touch</td></tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c504a;line-height:1.8;">
            <a href="https://www.instagram.com/shopmoi/" style="color:#1a1714;text-decoration:underline;">Instagram</a> — @shopmoi<br/>
            <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">Email</a> — hello@buy-moi.com
          </td>
        </tr>
      </table>`,
    orderNumber: draftOrderId,
    total,
    paymentLabel: "InstaPay Transfer",
    address: "",
    city: "",
    governorate: "",
    siteUrl,
  });

  const text = `Payment Not Confirmed — Moi\n\n${name ? `We're sorry, ${name}.` : "We're sorry."}\n\nWe were unable to confirm your payment for Draft Order #${draftOrderId}. Your order has been cancelled.${reasonText}\n\nDraft Order: #${draftOrderId}\nInstaPay Ref: ${referenceNumber}\nTotal: ${total} EGP\nStatus: Payment Not Confirmed\n\nIf you need any help, please contact us:\nInstagram: @shopmoi\nEmail: hello@buy-moi.com\n\nXoXo, Moi.\uD83D\uDC8B\n\nbuy-moi.com`;

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
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  previewText?: string;
}): { html: string; text: string } {
  const {
    lineItems,
    totalAmount,
    recoveryUrl,
    siteUrl = "https://buy-moi.com",
    headline = "Our MOI pieces are waiting for you.",
    subheadline = "Complete your wardrobe before they sell out.",
    ctaText = "Complete My Order",
    previewText,
  } = params;

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
<!-- Hidden preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText ? previewText + " " : ""}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;</div>

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
          <h1 class="hero-title" style="margin:0 0 10px;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;font-weight:400;color:#1a1714;line-height:1.25;letter-spacing:-0.01em;">${headline}</h1>
          <p class="hero-sub" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#5c504a;">${subheadline}</p>
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
                        ${ctaText}
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
                <p style="margin:0 0 20px;text-align:center;">
                  <a href="https://www.instagram.com/shopmoi/" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#1a1714;text-decoration:none;">Instagram</a>
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c8bfb5;padding:0 10px;">|</span>
                  <a href="https://www.tiktok.com/@shopmoi_" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#1a1714;text-decoration:none;">TikTok</a>
                </p>
                <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.55em;text-transform:uppercase;color:#1a1714;text-align:center;">M O I</p>
                <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;text-align:center;">Effortless. Versatile. Yours.</p>
                <p style="margin:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#5c504a;text-align:center;">XoXo, Moi.&#x1F48B;</p>
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

  const text = `${headline}\n\n${subheadline}\n\nYOUR CART:\n${itemsText}\n\n${ctaText}:\n${recoveryUrl}\n\nQuestions? Contact us at hello@buy-moi.com\nInstagram: https://www.instagram.com/shopmoi/\nTikTok: https://www.tiktok.com/@shopmoi_\n\nXoXo, Moi.\uD83D\uDC8B\n\nbuy-moi.com`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// Admin Payment Notification Email (sent to store owner on card payment)
// ---------------------------------------------------------------------------

export function buildAdminPaymentNotificationEmail(params: {
  draftOrderId: number | string;
  /** Human-readable Shopify order number (e.g. 1085). Falls back to draftOrderId if omitted. */
  orderNumber?: number | string;
  paymobTxnId: string;
  amount: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    address: string;
    governorate: string;
    city: string;
  };
  lineItems?: EmailLineItem[];
  discountAmount?: number;
  discountCode?: string;
  shippingAmount?: string;
}): { html: string; text: string } {
  const { draftOrderId, orderNumber, paymobTxnId, amount, customer, lineItems, discountAmount, discountCode, shippingAmount } = params;
  const displayOrderNumber = orderNumber ?? draftOrderId;
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN ?? "";
  const adminUrl = storeDomain
    ? `https://${storeDomain}/admin/orders/${draftOrderId}`
    : "";
  const dashboardUrl = `${getSiteUrl()}/admin`;
  const now = new Date().toLocaleString("en-EG", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" });

  const itemRows = lineItems && lineItems.length > 0
    ? lineItems.map((item) => {
        const variant = item.variant_title && item.variant_title !== "Default Title"
          ? ` — ${item.variant_title}` : "";
        return `<tr>
          <td style="padding:8px 0;border-top:1px solid #e8e3dc;font-family:Arial,sans-serif;font-size:13px;color:#1a1714;">${item.title}${variant}</td>
          <td style="padding:8px 0;border-top:1px solid #e8e3dc;font-family:Arial,sans-serif;font-size:13px;color:#1a1714;text-align:center;">×${item.quantity}</td>
          <td style="padding:8px 0;border-top:1px solid #e8e3dc;font-family:Arial,sans-serif;font-size:13px;color:#1a1714;text-align:right;white-space:nowrap;">${String(item.price).replace(/\s*EGP\s*/i, "").trim()} EGP</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="3" style="padding:8px 0;border-top:1px solid #e8e3dc;font-family:Arial,sans-serif;font-size:13px;color:#9a8e82;">(items not available)</td></tr>`;

  const shippingNum = parseEGP(shippingAmount ?? "0");
  const discountNum = discountAmount ?? 0;
  const subtotalNum = parseEGP(amount) - shippingNum + discountNum;

  const breakdownRows = [
    `<tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:12px;color:#5c504a;">Subtotal</td><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:12px;color:#1a1714;text-align:right;">${subtotalNum.toFixed(2)} EGP</td></tr>`,
    discountNum > 0 ? `<tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:12px;color:#5c504a;">Discount${discountCode ? ` (${discountCode})` : ""}</td><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:12px;color:#c0392b;text-align:right;">−${discountNum.toFixed(2)} EGP</td></tr>` : "",
    `<tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:12px;color:#5c504a;">Shipping</td><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:12px;color:#1a1714;text-align:right;">${shippingNum === 0 ? "Free" : `${shippingNum.toFixed(2)} EGP`}</td></tr>`,
    `<tr><td style="padding:10px 0 5px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1a1714;border-top:2px solid #1a1714;">TOTAL</td><td style="padding:10px 0 5px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1a1714;text-align:right;border-top:2px solid #1a1714;">${parseEGP(amount).toFixed(2)} EGP</td></tr>`,
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Card Payment Confirmed — Admin</title>
</head>
<body style="margin:0;padding:0;background:#e8e3dc;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;">
<tr><td align="center" style="padding:32px 16px 48px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top accent -->
    <tr><td style="background:#1a7a3e;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td style="padding:28px 40px 20px;border-bottom:1px solid #e8e3dc;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Admin Notification</p>
            <p style="margin:6px 0 0;font-family:Georgia,serif;font-size:22px;color:#1a1714;font-weight:400;">Card Payment Confirmed</p>
          </td>
          <td style="text-align:right;vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;background:#1a7a3e;color:#ffffff;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:5px 12px;">✓ PAID</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Payment Summary -->
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Payment Details</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e3dc;">
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;border-bottom:1px solid #e8e3dc;width:40%;">Order</td>
          <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:13px;color:#1a1714;font-weight:700;border-bottom:1px solid #e8e3dc;">#${displayOrderNumber}${adminUrl ? `&nbsp;&nbsp;<a href="${adminUrl}" style="color:#1a6ad4;font-size:11px;font-family:Arial,sans-serif;font-weight:400;">View in Shopify →</a>` : ""}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;border-bottom:1px solid #e8e3dc;">Paymob TXN</td>
          <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:13px;color:#1a1714;font-weight:700;border-bottom:1px solid #e8e3dc;">${paymobTxnId}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;border-bottom:1px solid #e8e3dc;">Amount Paid</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:15px;color:#1a7a3e;font-weight:700;border-bottom:1px solid #e8e3dc;">${parseEGP(amount).toFixed(2)} EGP</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;">Date (Cairo)</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#1a1714;">${now}</td>
        </tr>
      </table>
    </td></tr>

    <!-- Customer -->
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Customer</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e3dc;">
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;border-bottom:1px solid #e8e3dc;width:40%;">Name</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#1a1714;font-weight:700;border-bottom:1px solid #e8e3dc;">${customer.firstName} ${customer.lastName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;border-bottom:1px solid #e8e3dc;">Phone</td>
          <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:13px;color:#1a1714;border-bottom:1px solid #e8e3dc;">${customer.phone}</td>
        </tr>
        ${customer.email ? `<tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;border-bottom:1px solid #e8e3dc;">Email</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#1a1714;border-bottom:1px solid #e8e3dc;"><a href="mailto:${customer.email}" style="color:#1a6ad4;">${customer.email}</a></td>
        </tr>` : ""}
        <tr>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#9a8e82;">Address</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#1a1714;">${customer.address}, ${customer.city}, ${customer.governorate}</td>
        </tr>
      </table>
    </td></tr>

    <!-- Items -->
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Items Ordered</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th style="padding:6px 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;text-align:left;font-weight:700;">Product</th>
          <th style="padding:6px 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;text-align:center;font-weight:700;">Qty</th>
          <th style="padding:6px 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;text-align:right;font-weight:700;">Price</th>
        </tr>
        ${itemRows}
      </table>
    </td></tr>

    <!-- Breakdown -->
    <tr><td style="padding:16px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-left:auto;max-width:240px;">
        ${breakdownRows}
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:28px 40px 0;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="padding:0 6px 0 0;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#1a5c3a;color:#ffffff;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;padding:14px 28px;text-decoration:none;">Go to Admin Dashboard</a>
          </td>
          ${adminUrl ? `<td style="padding:0 0 0 6px;">
            <a href="${adminUrl}" style="display:inline-block;background:transparent;color:#1a1714;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;padding:13px 28px;text-decoration:none;border:1px solid #1a1714;">View in Shopify</a>
          </td>` : ""}
        </tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:28px 40px 24px;border-top:1px solid #e8e3dc;margin-top:28px;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#b0a89e;text-align:center;">This is an automated notification sent to the Moi store admin.<br />Payment method: Credit/Debit Card via Paymob</p>
    </td></tr>

    <!-- Bottom accent -->
    <tr><td style="background:#1a1714;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const itemsText = lineItems && lineItems.length > 0
    ? lineItems.map((i) => {
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` — ${i.variant_title}` : "";
        return `  ${i.title}${v} × ${i.quantity}  (${String(i.price).replace(/\s*EGP\s*/i, "").trim()} EGP)`;
      }).join("\n")
    : "  (items not available)";

  const text = [
    `ADMIN NOTIFICATION — CARD PAYMENT CONFIRMED`,
    ``,
    `Order:  #${displayOrderNumber}`,
    `Admin Dashboard: ${dashboardUrl}`,
    adminUrl ? `Shopify Admin: ${adminUrl}` : "",
    `Paymob TXN:   ${paymobTxnId}`,
    `Amount Paid:  ${parseEGP(amount).toFixed(2)} EGP`,
    `Date (Cairo): ${now}`,
    ``,
    `CUSTOMER`,
    `Name:    ${customer.firstName} ${customer.lastName}`,
    `Phone:   ${customer.phone}`,
    customer.email ? `Email:   ${customer.email}` : "",
    `Address: ${customer.address}, ${customer.city}, ${customer.governorate}`,
    ``,
    `ITEMS`,
    itemsText,
    ``,
    `BREAKDOWN`,
    `Subtotal:  ${subtotalNum.toFixed(2)} EGP`,
    discountNum > 0 ? `Discount${discountCode ? ` (${discountCode})` : ""}:  −${discountNum.toFixed(2)} EGP` : "",
    `Shipping:  ${shippingNum === 0 ? "Free" : `${shippingNum.toFixed(2)} EGP`}`,
    `TOTAL:     ${parseEGP(amount).toFixed(2)} EGP`,
  ].filter((l) => l !== "").join("\n");

  return { html, text };
}

// ---------------------------------------------------------------------------
// New Review Admin Notification
// ---------------------------------------------------------------------------

export function buildNewReviewAdminEmail(params: {
  author: string;
  email: string;
  productHandle: string;
  rating: number;
  title: string;
  body: string;
  adminUrl: string;
}): { html: string; text: string } {
  const { author, email, productHandle, rating, title, body, adminUrl } = params;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>New Review — Moi Admin</title>
</head>
<body style="margin:0;padding:0;background:#e8e3dc;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;overflow:hidden;max-height:0;">New ${rating}-star review awaiting moderation on ${productHandle}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;">
<tr><td align="center" style="padding:40px 16px 48px;">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;">
    <tr><td style="background:#1a1714;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #ede9e3;">
      <p style="margin:0 0 4px;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;font-weight:700;">Moi Admin</p>
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#1a1714;">New Review Submitted</h1>
    </td></tr>
    <tr><td style="padding:28px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#9a8e82;padding:10px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;width:110px;">Product</td>
          <td style="font-size:13px;color:#1a1714;padding:10px 0;border-top:1px solid #ede9e3;font-weight:600;">${productHandle}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#9a8e82;padding:10px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Rating</td>
          <td style="font-size:15px;color:#c8a96e;padding:10px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">${stars}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#9a8e82;padding:10px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;">Reviewer</td>
          <td style="font-size:13px;color:#1a1714;padding:10px 0;border-top:1px solid #ede9e3;">${author || "Anonymous"}${email ? ` &lt;<a href="mailto:${email}" style="color:#1a1714;">${email}</a>&gt;` : ""}</td>
        </tr>
        ${title ? `<tr>
          <td style="font-size:12px;color:#9a8e82;padding:10px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;vertical-align:top;">Title</td>
          <td style="font-size:13px;color:#1a1714;padding:10px 0;border-top:1px solid #ede9e3;">${title}</td>
        </tr>` : ""}
        <tr>
          <td style="font-size:12px;color:#9a8e82;padding:10px 0;border-top:1px solid #ede9e3;letter-spacing:0.05em;vertical-align:top;">Review</td>
          <td style="font-size:13px;color:#1a1714;padding:10px 0;border-top:1px solid #ede9e3;line-height:1.7;">${body.replace(/\n/g, "<br />")}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:28px 40px 40px;">
      <a href="${adminUrl}" style="display:inline-block;padding:12px 28px;background:#1a1714;font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#fff;text-decoration:none;">Review in Admin</a>
    </td></tr>
    <tr><td style="background:#1a1714;height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `NEW REVIEW — MOI ADMIN`,
    ``,
    `Product: ${productHandle}`,
    `Rating:  ${rating}/5`,
    `By:      ${author || "Anonymous"}${email ? ` <${email}>` : ""}`,
    title ? `Title:   ${title}` : "",
    ``,
    body,
    ``,
    `Moderate: ${adminUrl}`,
  ].filter((l) => l !== "").join("\n");

  return { html, text };
}

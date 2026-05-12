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
// Shared layout primitives
// ---------------------------------------------------------------------------

function emailShell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Moi</title>
</head>
<body style="margin:0;padding:0;background:#e8e4de;font-family:Arial,'Helvetica Neue',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e4de;padding:32px 0 48px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        ${body}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function header(): string {
  return `
    <tr>
      <td bgcolor="#1e1814" style="padding:28px 40px;text-align:center;">
        <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.65em;color:#faf8f5;text-transform:uppercase;text-decoration:none;">M O I</span>
      </td>
    </tr>`;
}

function statusBanner(label: string, color: "#1e1814" | "#7a6054" | "#b08d6a"): string {
  return `
    <tr>
      <td bgcolor="${color}" style="padding:10px 40px;text-align:center;">
        <span style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;color:#faf8f5;text-transform:uppercase;">${label}</span>
      </td>
    </tr>`;
}

function bodyOpen(): string {
  return `
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:48px 40px 0;">`;
}

function bodyClose(): string {
  return `
      </td>
    </tr>`;
}

function footer(siteUrl: string = "https://buy-moi.com"): string {
  return `
    <tr>
      <td bgcolor="#1e1814" style="padding:28px 40px;text-align:center;border-top:1px solid rgba(250,248,245,0.08);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <span style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.55em;color:#faf8f5;text-transform:uppercase;">M O I</span>
            </td>
          </tr>
          <tr>
            <td align="center">
              <a href="${siteUrl}" style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.25em;color:rgba(250,248,245,0.45);text-transform:uppercase;text-decoration:none;">Shop</a>
              <span style="color:rgba(250,248,245,0.2);padding:0 12px;">|</span>
              <a href="mailto:hello@buy-moi.com" style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.25em;color:rgba(250,248,245,0.45);text-transform:uppercase;text-decoration:none;">Contact</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:20px;">
              <span style="font-family:Arial,sans-serif;font-size:9px;color:rgba(250,248,245,0.25);letter-spacing:0.12em;">© 2025 Moi. All rights reserved.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function divider(): string {
  return `<tr><td style="padding:0 40px;"><div style="height:1px;background:#e4dfd8;margin:32px 0;"></div></td></tr>`;
}

function ctaButton(label: string, href: string): string {
  return `
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:32px 40px 48px;text-align:center;">
        <a href="${href}" style="display:inline-block;background:#1e1814;color:#faf8f5;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.38em;text-transform:uppercase;text-decoration:none;padding:14px 36px;">
          ${label}
        </a>
      </td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Re-usable blocks
// ---------------------------------------------------------------------------

function orderSummaryBlock(params: {
  orderNumber: number | string;
  total: string;
  paymentLabel: string;
  address: string;
  city: string;
  governorate: string;
  note?: string;
}): string {
  const { orderNumber, total, paymentLabel, address, city, governorate, note } = params;
  const rows = [
    { label: "Order", value: `#${orderNumber}` },
    { label: "Total", value: `${total} EGP` },
    { label: "Payment", value: paymentLabel },
    { label: "Ship to", value: `${address}, ${city}, ${governorate}` },
    ...(note ? [{ label: "Note", value: note }] : []),
  ];

  const rowsHtml = rows.map((r, i) => `
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a8e82;padding:10px 0;${i > 0 ? "border-top:1px solid #ddd8d0;" : ""}vertical-align:top;padding-right:16px;white-space:nowrap;">
        ${r.label}
      </td>
      <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e1814;padding:10px 0;${i > 0 ? "border-top:1px solid #ddd8d0;" : ""}text-align:right;font-weight:600;">
        ${r.value}
      </td>
    </tr>`).join("");

  return `
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f3efe9;border-left:2px solid #1e1814;padding:20px 24px;">
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
            </table>
          </td></tr>
        </table>
      </td>
    </tr>`;
}

function lineItemsBlock(items: EmailLineItem[]): string {
  if (!items.length) return "";

  const itemsHtml = items.map((item, i) => {
    const variant = item.variant_title && item.variant_title !== "Default Title"
      ? `<br><span style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#9a8e82;">${item.variant_title}</span>`
      : "";
    return `
      <tr>
        <td style="padding:14px 0;${i > 0 ? "border-top:1px solid #e4dfd8;" : ""}vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#1e1814;font-weight:600;line-height:1.4;">
                  ${item.title}${variant}
                </p>
                <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#9a8e82;">
                  Qty ${item.quantity}
                </p>
              </td>
              <td style="text-align:right;vertical-align:top;white-space:nowrap;padding-left:16px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#1e1814;font-weight:600;">${item.price} EGP</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  return `
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:0 40px;">
        <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.45em;text-transform:uppercase;color:#9a8e82;">
          Your Items
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemsHtml}
        </table>
      </td>
    </tr>`;
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
// COD Order Email — "Order Placed, pay on arrival"
// ---------------------------------------------------------------------------

export function buildCODOrderEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  address: string;
  governorate: string;
  city: string;
  lineItems?: EmailLineItem[];
}): { html: string; text: string } {
  const { orderNumber, customerName, total, address, governorate, city, lineItems } = params;
  const greeting = customerName ? `Hi ${customerName},` : "Hello,";
  const siteUrl = "https://buy-moi.com";

  const html = emailShell(`
    ${header()}
    ${statusBanner("Order Placed", "#1e1814")}
    ${bodyOpen()}
      <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#7a6e64;">${greeting}</p>
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;color:#1e1814;margin:0 0 20px;line-height:1.2;">
        Your order has been placed.
      </h1>
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;line-height:1.8;color:#5a5048;">
        Thank you for shopping with Moi. Our team will reach out shortly to confirm your delivery details and collect payment on arrival.
      </p>
      <p style="margin:0 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.8;color:#5a5048;">
        A WhatsApp confirmation has also been sent to your number.
      </p>
    ${bodyClose()}
    ${divider()}
    ${orderSummaryBlock({
      orderNumber,
      total,
      paymentLabel: "Cash on Delivery",
      address,
      city,
      governorate,
    })}
    ${lineItems && lineItems.length > 0 ? `
    ${divider()}
    ${lineItemsBlock(lineItems)}` : ""}
    ${divider()}
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:0 40px 48px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:#9a8e82;border-left:2px solid #c8c0b6;padding-left:16px;">
          You'll receive a WhatsApp message with your tracking number once your order is on its way. If you have any questions, reply to this email or message us directly.
        </p>
      </td>
    </tr>
    ${ctaButton("Continue Shopping", siteUrl)}
    ${footer(siteUrl)}
  `);

  const itemsText = lineItems && lineItems.length > 0
    ? "\nItems:\n" + lineItems.map((i) => {
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` — ${i.variant_title}` : "";
        return `  ${i.title}${v} × ${i.quantity}  (${i.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const text = `Order Placed — Moi\n\n${greeting}\n\nYour order has been placed. Our team will reach out to arrange delivery and collect payment on arrival.\n\nOrder #${orderNumber}\n${itemsText}Total: ${total} EGP\nPayment: Cash on Delivery\nShip to: ${address}, ${city}, ${governorate}\n\nYou'll receive a WhatsApp message with your tracking number once your order is on its way.\n\nThank you for shopping with Moi.\n${siteUrl}`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// Card / Paid Order Email — "Order Confirmed, payment received"
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
}): { html: string; text: string } {
  const { orderNumber, customerName, total, paymentMethod, address, governorate, city, lineItems } = params;
  const greeting = customerName ? `Hi ${customerName},` : "Hello,";
  const siteUrl = "https://buy-moi.com";

  const html = emailShell(`
    ${header()}
    ${statusBanner("Payment Confirmed", "#1e1814")}
    ${bodyOpen()}
      <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#7a6e64;">${greeting}</p>
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;color:#1e1814;margin:0 0 20px;line-height:1.2;">
        Your order is confirmed.
      </h1>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:1.8;color:#5a5048;">
        We've received your payment and your order is now being prepared. You'll receive a WhatsApp message with your tracking number once your order is on its way.
      </p>
    ${bodyClose()}
    ${divider()}
    ${orderSummaryBlock({
      orderNumber,
      total,
      paymentLabel: paymentMethod,
      address,
      city,
      governorate,
    })}
    ${lineItems && lineItems.length > 0 ? `
    ${divider()}
    ${lineItemsBlock(lineItems)}` : ""}
    ${divider()}
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:0 40px 48px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:#9a8e82;border-left:2px solid #c8c0b6;padding-left:16px;">
          If you have any questions about your order, please reply to this email or message us on WhatsApp and we'll be happy to help.
        </p>
      </td>
    </tr>
    ${ctaButton("Continue Shopping", siteUrl)}
    ${footer(siteUrl)}
  `);

  const itemsText = lineItems && lineItems.length > 0
    ? "\nItems:\n" + lineItems.map((i) => {
        const v = i.variant_title && i.variant_title !== "Default Title" ? ` — ${i.variant_title}` : "";
        return `  ${i.title}${v} × ${i.quantity}  (${i.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const text = `Order Confirmed — Moi\n\n${greeting}\n\nYour order is confirmed and is now being prepared.\n\nOrder #${orderNumber}\n${itemsText}Total: ${total} EGP\nPayment: ${paymentMethod}\nShip to: ${address}, ${city}, ${governorate}\n\nYou'll receive a WhatsApp message with your tracking number once your order ships.\n\nThank you for shopping with Moi.\n${siteUrl}`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// InstaPay Pending Email — "Payment verification in progress"
// ---------------------------------------------------------------------------

export function buildInstapayPendingEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  referenceNumber: string;
}): { html: string; text: string } {
  const { orderNumber, customerName, total, referenceNumber } = params;
  const greeting = customerName ? `Hi ${customerName},` : "Hello,";
  const siteUrl = "https://buy-moi.com";

  const html = emailShell(`
    ${header()}
    ${statusBanner("Verifying Payment", "#7a6054")}
    ${bodyOpen()}
      <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#7a6e64;">${greeting}</p>
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;color:#1e1814;margin:0 0 20px;line-height:1.2;">
        We're verifying your payment.
      </h1>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:1.8;color:#5a5048;">
        We've received your InstaPay proof and your order is pending payment verification. Our team will review it shortly — usually within a few hours.
      </p>
    ${bodyClose()}
    ${divider()}
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f3efe9;border-left:2px solid #b08d6a;padding:20px 24px;">
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a8e82;padding:10px 0;padding-right:16px;white-space:nowrap;vertical-align:top;">Order</td>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e1814;padding:10px 0;text-align:right;font-weight:600;">#${orderNumber}</td>
              </tr>
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a8e82;padding:10px 0;border-top:1px solid #ddd8d0;padding-right:16px;white-space:nowrap;vertical-align:top;">Total</td>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e1814;padding:10px 0;border-top:1px solid #ddd8d0;text-align:right;font-weight:600;">${total} EGP</td>
              </tr>
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a8e82;padding:10px 0;border-top:1px solid #ddd8d0;padding-right:16px;white-space:nowrap;vertical-align:top;">InstaPay Ref</td>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e1814;padding:10px 0;border-top:1px solid #ddd8d0;text-align:right;font-weight:600;font-family:'Courier New',monospace;">${referenceNumber}</td>
              </tr>
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a8e82;padding:10px 0;border-top:1px solid #ddd8d0;padding-right:16px;white-space:nowrap;vertical-align:top;">Status</td>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#b08d6a;padding:10px 0;border-top:1px solid #ddd8d0;text-align:right;font-weight:600;">Pending Verification</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td>
    </tr>
    ${divider()}
    <tr>
      <td bgcolor="#faf8f5" style="border-left:1px solid #ddd8d0;border-right:1px solid #ddd8d0;padding:0 40px 48px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:#9a8e82;border-left:2px solid #c8c0b6;padding-left:16px;">
          Once your transfer is verified, you'll receive a confirmation message on WhatsApp and your order will be dispatched. If you have any questions, simply reply to this email.
        </p>
      </td>
    </tr>
    ${ctaButton("Continue Shopping", siteUrl)}
    ${footer(siteUrl)}
  `);

  const text = `Payment Verification in Progress — Moi\n\n${greeting}\n\nWe've received your InstaPay proof and your order is pending verification.\n\nOrder #${orderNumber}\nTotal: ${total} EGP\nInstaPay Ref: ${referenceNumber}\nStatus: Pending Verification\n\nOnce verified, you'll receive a WhatsApp confirmation and your order will be dispatched.\n\nThank you for shopping with Moi.\n${siteUrl}`;

  return { html, text };
}

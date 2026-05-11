import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  _transporter = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: apiKey },
  });
  return _transporter;
}

function getBrandFrom(): string {
  return `Moi <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: getBrandFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  });
}

const HEADER = `
  <div style="background:#1e1814;padding:24px 40px;text-align:center;">
    <span style="color:#faf8f5;letter-spacing:0.55em;font-size:12px;font-weight:700;text-transform:uppercase;">M O I</span>
  </div>`;

const FOOTER = `
  <div style="background:#1e1814;padding:16px 40px;text-align:center;">
    <span style="color:rgba(250,248,245,0.40);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;">moi — premium fashion</span>
  </div>`;

function wrapEmail(body: string): string {
  return `<div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#faf8f5;">${HEADER}<div style="padding:48px 40px;border-left:1px solid #e8e4de;border-right:1px solid #e8e4de;">${body}</div>${FOOTER}</div>`;
}

export interface EmailLineItem {
  title: string;
  variant_title?: string | null;
  quantity: number;
  price: string;
}

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

  const itemsHtml = lineItems && lineItems.length > 0
    ? `<tr><td colspan="2" style="padding:4px 0;"><div style="margin-top:6px;border-top:1px solid #ddd8d0;padding-top:10px;">${
        lineItems.map((item) => {
          const variant = item.variant_title && item.variant_title !== "Default Title" ? ` — ${item.variant_title}` : "";
          return `<div style="display:flex;justify-content:space-between;font-size:12px;color:#1e1814;padding:3px 0;"><span>${item.title}${variant} × ${item.quantity}</span><span style="white-space:nowrap;margin-left:16px;">${item.price} EGP</span></div>`;
        }).join("")
      }</div></td></tr>`
    : "";

  const itemsText = lineItems && lineItems.length > 0
    ? "\nItems:\n" + lineItems.map((item) => {
        const variant = item.variant_title && item.variant_title !== "Default Title" ? ` — ${item.variant_title}` : "";
        return `  ${item.title}${variant} × ${item.quantity}  (${item.price} EGP)`;
      }).join("\n") + "\n"
    : "";

  const html = wrapEmail(`
    <p style="font-size:13px;color:#5a5048;margin:0 0 8px;">${greeting}</p>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#1e1814;margin:0 0 24px;line-height:1.2;">
      Order Confirmed
    </h1>
    <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 6px;">
      Thank you for your order. We've received your payment and your order is now being prepared.
    </p>
    <div style="margin:28px 0;padding:20px 24px;background:#f3f0ec;border-left:2px solid #1e1814;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="color:#7a6e64;padding:4px 0;">Order</td><td style="color:#1e1814;font-weight:600;text-align:right;">#${orderNumber}</td></tr>
        ${itemsHtml}
        <tr><td style="color:#7a6e64;padding:4px 0;">Total</td><td style="color:#1e1814;font-weight:600;text-align:right;">${total} EGP</td></tr>
        <tr><td style="color:#7a6e64;padding:4px 0;">Payment</td><td style="color:#1e1814;text-align:right;">${paymentMethod}</td></tr>
        <tr><td style="color:#7a6e64;padding:4px 0;vertical-align:top;">Ship to</td><td style="color:#1e1814;text-align:right;">${address}, ${city}, ${governorate}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 6px;">
      You'll receive a WhatsApp message with your tracking number once your order is on its way.
    </p>
    <p style="font-size:11px;color:#9a8e82;letter-spacing:0.12em;text-transform:uppercase;margin:32px 0 0;">Thank you for shopping with Moi.</p>
  `);

  const text = `Order Confirmed — Moi\n\n${greeting}\n\nOrder #${orderNumber}\n${itemsText}Total: ${total} EGP\nPayment: ${paymentMethod}\nShip to: ${address}, ${city}, ${governorate}\n\nYou'll receive a WhatsApp message with your tracking number once your order ships.\n\nThank you for shopping with Moi.`;

  return { html, text };
}

export function buildInstapayPendingEmail(params: {
  orderNumber: number | string;
  customerName: string;
  total: string;
  referenceNumber: string;
}): { html: string; text: string } {
  const { orderNumber, customerName, total, referenceNumber } = params;
  const greeting = customerName ? `Hi ${customerName},` : "Hello,";

  const html = wrapEmail(`
    <p style="font-size:13px;color:#5a5048;margin:0 0 8px;">${greeting}</p>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#1e1814;margin:0 0 24px;line-height:1.2;">
      Payment Verification in Progress
    </h1>
    <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 6px;">
      We've received your InstaPay proof and your order is now pending verification. Our team will confirm it shortly.
    </p>
    <div style="margin:28px 0;padding:20px 24px;background:#f3f0ec;border-left:2px solid #1e1814;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="color:#7a6e64;padding:4px 0;">Order</td><td style="color:#1e1814;font-weight:600;text-align:right;">#${orderNumber}</td></tr>
        <tr><td style="color:#7a6e64;padding:4px 0;">Total</td><td style="color:#1e1814;font-weight:600;text-align:right;">${total} EGP</td></tr>
        <tr><td style="color:#7a6e64;padding:4px 0;">InstaPay Ref</td><td style="color:#1e1814;font-family:'Courier New',monospace;text-align:right;">${referenceNumber}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 6px;">
      Once your transfer is verified, you'll receive a confirmation message on WhatsApp and your order will be dispatched.
    </p>
    <p style="font-size:11px;color:#9a8e82;letter-spacing:0.12em;text-transform:uppercase;margin:32px 0 0;">Thank you for shopping with Moi.</p>
  `);

  const text = `Payment Verification in Progress — Moi\n\n${greeting}\n\nOrder #${orderNumber}\nTotal: ${total} EGP\nInstaPay Ref: ${referenceNumber}\n\nOur team will verify your transfer and confirm via WhatsApp. Thank you for shopping with Moi.`;

  return { html, text };
}

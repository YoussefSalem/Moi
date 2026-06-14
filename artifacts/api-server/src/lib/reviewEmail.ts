import { getSiteUrl } from "./siteUrl.js";

export interface ReviewEmailProduct {
  name: string;
  slug: string;
  id: string;
}

const SUBJECTS = [
  (name: string) => `how was your order, ${name}? 🤍`,
  () => `we've been thinking about you 🥰`,
  () => `your order's had time to settle — how is it? ✨`,
];

function pickSubject(customerName: string, orderId: string): string {
  const seed = orderId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const fn = SUBJECTS[seed % SUBJECTS.length];
  const first = customerName ? customerName.split(" ")[0] : "lovely";
  return fn(first);
}

function reviewLink(siteUrl: string, slug: string, orderId: string, email: string): string {
  const base = slug ? `${siteUrl}/product/${slug}` : `${siteUrl}/shop`;
  return `${base}?review=true&orderId=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`;
}

function productLink(siteUrl: string, slug: string): string {
  return slug ? `${siteUrl}/product/${slug}` : `${siteUrl}/shop`;
}

function buildProductCard(
  product: ReviewEmailProduct,
  orderId: string,
  email: string,
  siteUrl: string
): string {
  const rLink = reviewLink(siteUrl, product.slug, orderId, email);
  const pLink = productLink(siteUrl, product.slug);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #ede9e3;border-radius:2px;">
      <tr>
        <td style="padding:28px 28px 24px;">
          <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#b0a89e;font-weight:700;">Your piece</p>
          <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;color:#1a1714;font-weight:400;line-height:1.2;">${product.name}</p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c504a;line-height:1.7;">
            Hey, how's it been going with your <strong>${product.name}</strong>? I really hope you're obsessed with it 🥰 when you've got a minute, I'd love to know what you think — honestly.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#1a1714;margin-right:12px;">
                <a href="${rLink}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;">
                  Tell me what you think 💬
                </a>
              </td>
              <td style="width:12px;"></td>
              <td style="border:1px solid #1a1714;">
                <a href="${pLink}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#1a1714;text-decoration:none;white-space:nowrap;">
                  View it again
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildFallbackSection(products: ReviewEmailProduct[], siteUrl: string): string {
  const fallbackLink =
    products.length === 1
      ? productLink(siteUrl, products[0].slug)
      : `${siteUrl}/shop`;

  return `
    <tr><td style="padding:0 48px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ede9e3;border-radius:2px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6e64;line-height:1.6;">
              if the form's being annoying, don't stress at all — just drop your thoughts here instead 🤍
            </p>
            <a href="${fallbackLink}" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1714;text-decoration:underline;font-weight:600;">
              leave a note on our website →
            </a>
          </td>
        </tr>
      </table>
    </td></tr>`;
}

export function buildReviewEmail(params: {
  customerName: string;
  orderId: string;
  customerEmail: string;
  products: ReviewEmailProduct[];
  siteUrl?: string;
}): { html: string; text: string; subject: string } {
  const { customerName, orderId, customerEmail, products } = params;
  const siteUrl = params.siteUrl ?? getSiteUrl();
  const firstName = customerName ? customerName.split(" ")[0] : "lovely";
  const subject = pickSubject(customerName, orderId);

  const productCards = products.length > 0
    ? products.map((p) => buildProductCard(p, orderId, customerEmail, siteUrl)).join("")
    : buildProductCard(
        { name: "your Moi piece", slug: "", id: "" },
        orderId,
        customerEmail,
        siteUrl
      );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Moi — how was your order?</title>
</head>
<body style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader -->
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">it's been a day — I'd love to know how you're finding everything 🤍&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- Card -->
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top accent -->
    <tr><td style="background:#1a1714;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td style="padding:32px 48px 28px;border-bottom:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
              <img src="${siteUrl}/moi-m-logo.png" alt="Moi" width="40" height="40" style="display:block;border:0;" />
            </a>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#b0a89e;">Order&nbsp;#${orderId}</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero -->
    <tr><td style="padding:44px 48px 8px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:30px;font-weight:400;color:#1a1714;line-height:1.2;letter-spacing:-0.01em;">
        hey ${firstName}, your order just arrived 🥰
      </h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">
        it's been a full day since your package arrived and honestly — I've been dying to know what you think. you've had some time to try things on, so tell me everything 💬 it only takes like 20 seconds and it means the world to us.
      </p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:32px 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- Product cards -->
    <tr><td style="padding:0 48px;">
      ${productCards}
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:8px 48px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

    <!-- gap -->
    <tr><td style="height:32px;"></td></tr>

    <!-- Fallback -->
    ${buildFallbackSection(products, siteUrl)}

    <!-- Footer -->
    <tr><td style="padding:28px 48px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#5c504a;">XoXo, Moi.&#x1F48B;</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">
              Questions? <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">hello@buy-moi.com</a>
            </p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;line-height:1.6;">
              <a href="${siteUrl}" style="color:#b0a89e;text-decoration:none;letter-spacing:0.12em;">buy-moi.com</a>
            </p>
            <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#d0c8c0;line-height:1.5;">
              Reply to say hi — I actually read them 🤍
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Bottom accent -->
    <tr><td style="background:#1a1714;height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  const productText = products.length > 0
    ? products.map((p) => {
        const rLink = reviewLink(siteUrl, p.slug, orderId, customerEmail);
        return `  ${p.name}\n  Leave a review → ${rLink}`;
      }).join("\n\n")
    : `  Leave a review → ${siteUrl}/shop`;

  const fallbackLink = products.length === 1
    ? productLink(siteUrl, products[0].slug)
    : `${siteUrl}/shop`;

  const text = [
    `hey ${firstName}, your order just arrived 🥰 — Moi`,
    "",
    `it's been a full day since your package arrived and I've been dying to know what you think.`,
    `it only takes 20 seconds — tell me everything 💬`,
    "",
    productText,
    "",
    `if the form's being annoying, don't stress — just drop your thoughts here instead:`,
    fallbackLink,
    "",
    "XoXo, Moi.💋",
    "buy-moi.com",
  ].join("\n");

  return { html, text, subject };
}

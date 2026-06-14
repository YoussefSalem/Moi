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

function productLink(siteUrl: string, slug: string): string {
  return slug ? `${siteUrl}/product/${slug}` : `${siteUrl}/shop`;
}

function buildProductForm(
  product: ReviewEmailProduct,
  orderId: string,
  email: string,
  customerName: string,
  siteUrl: string
): string {
  const formAction = `${siteUrl}/api/review-email/submit`;
  const fallbackLink = productLink(siteUrl, product.slug);
  const firstName = customerName ? customerName.split(" ")[0] : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td style="padding:0 48px;">

  <!-- Product label -->
  <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.45em;text-transform:uppercase;color:#b0a89e;font-weight:700;">your piece</p>
  <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1a1714;font-weight:400;line-height:1.2;">${product.name}</p>

  <!-- Form card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #ede9e3;">
  <tr><td style="padding:28px 28px 24px;">

    <form action="${formAction}" method="POST" target="_blank" accept-charset="UTF-8">
      <input type="hidden" name="productHandle" value="${product.slug}" />
      <input type="hidden" name="email" value="${email}" />
      <input type="hidden" name="orderId" value="${orderId}" />
      <input type="hidden" name="author" value="${customerName}" />

      <!-- ── Star rating ──────────────────────────────────── -->
      <p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#1a1714;">how'd it do?</p>

      <div class="star-group" style="overflow:hidden;margin-bottom:24px;line-height:1;">
        <!-- Stars reversed in DOM so CSS sibling selector fills left-to-right -->
        <input type="radio" name="rating" value="5" id="r5_${product.id}" required class="star-input" />
        <label for="r5_${product.id}" class="star-label" title="5 stars">&#9733;</label>
        <input type="radio" name="rating" value="4" id="r4_${product.id}" class="star-input" />
        <label for="r4_${product.id}" class="star-label" title="4 stars">&#9733;</label>
        <input type="radio" name="rating" value="3" id="r3_${product.id}" class="star-input" />
        <label for="r3_${product.id}" class="star-label" title="3 stars">&#9733;</label>
        <input type="radio" name="rating" value="2" id="r2_${product.id}" class="star-input" />
        <label for="r2_${product.id}" class="star-label" title="2 stars">&#9733;</label>
        <input type="radio" name="rating" value="1" id="r1_${product.id}" class="star-input" />
        <label for="r1_${product.id}" class="star-label" title="1 star">&#9733;</label>
      </div>

      <!-- ── Name ─────────────────────────────────────────── -->
      <div style="margin-bottom:16px;">
        <label for="author_${product.id}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#9a8e82;font-weight:700;margin-bottom:6px;">your name</label>
        <input
          type="text"
          id="author_${product.id}"
          name="author"
          placeholder="how should we credit you?"
          value="${customerName}"
          maxlength="80"
          style="width:100%;box-sizing:border-box;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:#ffffff;border:1px solid #d4cdc7;border-radius:0;outline:none;-webkit-appearance:none;appearance:none;"
        />
      </div>

      <!-- ── Title ─────────────────────────────────────────── -->
      <div style="margin-bottom:16px;">
        <label for="title_${product.id}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#9a8e82;font-weight:700;margin-bottom:6px;">the title</label>
        <input
          type="text"
          id="title_${product.id}"
          name="title"
          placeholder="give it a headline"
          maxlength="200"
          style="width:100%;box-sizing:border-box;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:#ffffff;border:1px solid #d4cdc7;border-radius:0;outline:none;-webkit-appearance:none;appearance:none;"
        />
      </div>

      <!-- ── Body ──────────────────────────────────────────── -->
      <div style="margin-bottom:24px;">
        <label for="body_${product.id}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#9a8e82;font-weight:700;margin-bottom:6px;">the details, please</label>
        <textarea
          id="body_${product.id}"
          name="body"
          rows="4"
          maxlength="2000"
          placeholder="tell me everything — fit, feel, quality, all of it 🤍"
          style="width:100%;box-sizing:border-box;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:#ffffff;border:1px solid #d4cdc7;border-radius:0;outline:none;resize:vertical;-webkit-appearance:none;appearance:none;line-height:1.6;"
        ></textarea>
      </div>

      <!-- ── Submit ─────────────────────────────────────────── -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="text-align:center;">
            <button
              type="submit"
              style="background:#1a1714;color:#ffffff;border:none;padding:14px 48px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;cursor:pointer;-webkit-appearance:none;appearance:none;display:inline-block;"
            >post it.</button>
          </td>
        </tr>
      </table>

    </form>

    <!-- ── Fallback ───────────────────────────────────────── -->
    <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;text-align:center;line-height:1.7;">
      if the form's being annoying, don't stress at all —<br />
      <a href="${fallbackLink}?review=true&email=${encodeURIComponent(email)}&orderId=${encodeURIComponent(orderId)}" style="color:#1a1714;text-decoration:underline;">leave a note on our website instead 🤍</a>
    </p>

  </td></tr>
  </table>

</td></tr>
</table>`;
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

  const formBlocks = products.length > 0
    ? products.map((p) => buildProductForm(p, orderId, customerEmail, customerName, siteUrl)).join("")
    : buildProductForm(
        { name: "your Moi piece", slug: "", id: "default" },
        orderId,
        customerEmail,
        customerName,
        siteUrl
      );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Moi — how was your order?</title>
<style>
/* ── Star rating ──────────────────────────────────────────────── */
.star-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.star-label {
  float: right;
  font-size: 32px;
  line-height: 1;
  color: #d4cdc7;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.1s ease;
  -webkit-text-stroke: 0px;
}

/* Fill all stars from selected inward (siblings trick with reversed DOM) */
.star-input:checked ~ .star-label,
.star-group:hover .star-label:hover,
.star-group:hover .star-label:hover ~ .star-label {
  color: #1a1714;
}
.star-group .star-label:hover {
  color: #1a1714;
}

/* Input focus ring */
input[type="text"]:focus,
textarea:focus {
  border-color: #1a1714 !important;
  outline: none;
}

/* Button hover */
button[type="submit"]:hover {
  opacity: 0.85;
}

@media screen and (max-width: 480px) {
  .email-card { width: 100% !important; }
  .email-padding { padding-left: 24px !important; padding-right: 24px !important; }
  .star-label { font-size: 28px !important; padding: 0 3px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader -->
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">it's been a day — I'd love to know what you think. takes 20 seconds 🤍&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- Card -->
  <table role="presentation" width="560" class="email-card" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top accent -->
    <tr><td style="background:#1a1714;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td class="email-padding" style="padding:32px 48px 28px;border-bottom:1px solid #ede9e3;">
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

    <!-- Hero copy -->
    <tr><td class="email-padding" style="padding:44px 48px 12px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;font-weight:400;color:#1a1714;line-height:1.25;letter-spacing:-0.01em;">
        hey ${firstName} — spill it. 🤍
      </h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#5c504a;">
        your order arrived yesterday and honestly I've been curious ever since.<br />
        go on — rate it, write it, romanticize it. we'll be reading xoxo
      </p>
    </td></tr>

    <!-- Divider -->
    <tr><td class="email-padding" style="padding:28px 48px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid #ede9e3;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>

    <!-- Product form blocks -->
    ${formBlocks}

    <!-- Gap -->
    <tr><td style="height:36px;"></td></tr>

    <!-- Footer -->
    <tr><td class="email-padding" style="padding:24px 48px 28px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#5c504a;">XoXo, Moi.&#x1F48B;</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">
              Questions? <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">hello@buy-moi.com</a>
            </p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;line-height:1.6;">
              <a href="${siteUrl}" style="color:#b0a89e;text-decoration:none;letter-spacing:0.12em;">buy-moi.com</a>
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#d0c8c0;">
              reply to say hi — I read them 🤍
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
        const link = productLink(siteUrl, p.slug);
        return `  ${p.name}\n  Leave a review → ${link}?review=true&email=${encodeURIComponent(customerEmail)}&orderId=${encodeURIComponent(orderId)}`;
      }).join("\n\n")
    : `  Leave a review → ${siteUrl}/shop`;

  const text = [
    `hey ${firstName} — spill it. 🤍 — Moi`,
    "",
    `your order arrived yesterday and honestly I've been curious ever since.`,
    `go on — rate it, write it, romanticize it. we'll be reading xoxo`,
    "",
    productText,
    "",
    "XoXo, Moi.💋",
    "buy-moi.com",
  ].join("\n");

  return { html, text, subject };
}

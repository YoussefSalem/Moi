import { getSiteUrl } from "./siteUrl.js";

export interface ReviewEmailProduct {
  name: string;
  slug: string;
  id: string;
}

const SUBJECTS = [
  (name: string) => `okay ${name}, how did she do? 🌸`,
  () => `we're dying to know ✨`,
  () => `spill it. your honest review 💌`,
];

function pickSubject(customerName: string, orderId: string): string {
  const seed = orderId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const fn = SUBJECTS[seed % SUBJECTS.length];
  const first = customerName ? customerName.split(" ")[0] : "gorgeous";
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
  const firstName = customerName ? customerName.split(" ")[0] : "love";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td style="padding:0 44px;">

  <!-- Product name above the card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr>
      <td style="border-left:2px solid #c9a07a;padding-left:12px;">
        <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#c9a07a;font-weight:700;">your piece ✦</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:21px;color:#1a1714;font-weight:400;line-height:1.2;">${product.name}</p>
      </td>
    </tr>
  </table>

  <!-- Form card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaf7;border:1px solid #e8ddd6;border-top:2px solid #c9a07a;">
  <tr><td style="padding:28px 26px 26px;">

    <form action="${formAction}" method="POST" target="_blank" accept-charset="UTF-8">
      <input type="hidden" name="productHandle" value="${product.slug}" />
      <input type="hidden" name="email" value="${email}" />
      <input type="hidden" name="orderId" value="${orderId}" />

      <!-- ── Star rating ──────────────────────────────────── -->
      <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;color:#1a1714;letter-spacing:-0.01em;">rate her. ✨</p>

      <div class="star-group" style="overflow:hidden;margin-bottom:28px;padding:4px 0;">
        <!-- Reverse DOM order so CSS sibling selector fills stars left-to-right -->
        <input type="radio" name="rating" value="5" id="r5_${product.id}" required class="star-input" />
        <label for="r5_${product.id}" class="star-label" title="5 — obsessed">&#9733;</label>
        <input type="radio" name="rating" value="4" id="r4_${product.id}" class="star-input" />
        <label for="r4_${product.id}" class="star-label" title="4 — loved it">&#9733;</label>
        <input type="radio" name="rating" value="3" id="r3_${product.id}" class="star-input" />
        <label for="r3_${product.id}" class="star-label" title="3 — it was okay">&#9733;</label>
        <input type="radio" name="rating" value="2" id="r2_${product.id}" class="star-input" />
        <label for="r2_${product.id}" class="star-label" title="2 — not my fave">&#9733;</label>
        <input type="radio" name="rating" value="1" id="r1_${product.id}" class="star-input" />
        <label for="r1_${product.id}" class="star-label" title="1 — didn't work">&#9733;</label>
      </div>

      <!-- Thin rose separator -->
      <div style="border-top:1px solid #f0e0d6;margin-bottom:22px;"></div>

      <!-- ── Name ─────────────────────────────────────────── -->
      <div style="margin-bottom:18px;">
        <label for="author_${product.id}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:7px;">your name, lovely</label>
        <input
          type="text"
          id="author_${product.id}"
          name="author"
          placeholder="how should we credit you?"
          value="${firstName}"
          maxlength="80"
          style="width:100%;box-sizing:border-box;padding:9px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:transparent;border:none;border-bottom:1px solid #d4c8be;outline:none;-webkit-appearance:none;appearance:none;"
        />
      </div>

      <!-- ── Title ─────────────────────────────────────────── -->
      <div style="margin-bottom:18px;">
        <label for="title_${product.id}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:7px;">give it a headline ✨</label>
        <input
          type="text"
          id="title_${product.id}"
          name="title"
          placeholder="in three words or less..."
          maxlength="200"
          style="width:100%;box-sizing:border-box;padding:9px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:transparent;border:none;border-bottom:1px solid #d4c8be;outline:none;-webkit-appearance:none;appearance:none;"
        />
      </div>

      <!-- ── Body ──────────────────────────────────────────── -->
      <div style="margin-bottom:26px;">
        <label for="body_${product.id}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:7px;">now spill, babe 💬</label>
        <textarea
          id="body_${product.id}"
          name="body"
          rows="4"
          maxlength="2000"
          placeholder="the fit, the feel, the way she made you feel — we want everything 🤍"
          style="width:100%;box-sizing:border-box;padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:#ffffff;border:1px solid #e2d8d0;border-radius:0;outline:none;resize:vertical;-webkit-appearance:none;appearance:none;line-height:1.7;"
        ></textarea>
      </div>

      <!-- ── Submit ─────────────────────────────────────────── -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="text-align:center;padding-bottom:4px;">
            <button
              type="submit"
              style="background:#1a1714;color:#ffffff;border:none;padding:14px 52px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.4em;text-transform:uppercase;cursor:pointer;-webkit-appearance:none;appearance:none;display:inline-block;"
            >share the love 💌</button>
          </td>
        </tr>
      </table>

    </form>

    <!-- ── Fallback ───────────────────────────────────────── -->
    <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;text-align:center;line-height:1.8;">
      if the form is being dramatic, no worries at all —<br />
      <a href="${fallbackLink}?review=true&email=${encodeURIComponent(email)}&orderId=${encodeURIComponent(orderId)}" style="color:#1a1714;text-decoration:underline;">drop your thoughts on the website instead 🤍</a>
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
  const firstName = customerName ? customerName.split(" ")[0] : "gorgeous";
  const subject = pickSubject(customerName, orderId);

  const formBlocks = products.length > 0
    ? products.map((p) => buildProductForm(p, orderId, customerEmail, customerName, siteUrl)).join(
        `<tr><td style="height:32px;"></td></tr>`
      )
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
<title>Moi — spill it 🌸</title>
<style>
/* ── Star rating: reverse-DOM float trick ─────────────────── */
.star-input {
  position: absolute !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  pointer-events: none !important;
}
.star-label {
  float: right;
  font-size: 34px;
  line-height: 1;
  color: #e2d8d0;
  cursor: pointer;
  padding: 0 5px;
  transition: color 0.12s ease;
}
/* Fill stars from selected inward (reverse DOM + sibling selector) */
.star-input:checked ~ .star-label {
  color: #c9a07a;
}
/* Hover: fill hovered star + all lower ones */
.star-group:not(:has(.star-input:checked)):hover .star-label,
.star-label:hover,
.star-label:hover ~ .star-label {
  color: #c9a07a;
}
/* Input focus highlight */
input[type="text"]:focus,
textarea:focus {
  border-color: #c9a07a !important;
  outline: none !important;
}
/* Button hover */
button[type="submit"]:hover {
  background: #2c2420 !important;
}
@media screen and (max-width: 480px) {
  .email-card  { width: 100% !important; }
  .email-pad   { padding-left: 20px !important; padding-right: 20px !important; }
  .star-label  { font-size: 28px !important; padding: 0 3px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Hidden preheader -->
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">she arrived yesterday and we haven't stopped thinking about you two 🌸&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- Card -->
  <table role="presentation" width="560" class="email-card" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top accent: champagne gold → dark -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td class="email-pad" style="padding:30px 44px 26px;border-bottom:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
              <img src="${siteUrl}/moi-m-logo.png" alt="Moi" width="38" height="38" style="display:block;border:0;" />
            </a>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#c9a07a;">Order&nbsp;#${orderId}</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero headline + copy -->
    <tr><td class="email-pad" style="padding:42px 44px 10px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;font-weight:400;color:#1a1714;line-height:1.25;letter-spacing:-0.01em;">
        okay ${firstName} —<br />she arrived. now spill. 🌸
      </h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.85;color:#5c504a;">
        she landed yesterday and honestly? we haven't stopped thinking about you two. tell us everything — the fit, the feel, the way she made you feel. be honest, be extra. we want the full tea.
      </p>
    </td></tr>

    <!-- Decorative rose divider -->
    <tr><td class="email-pad" style="padding:28px 44px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:40px;border-top:1px solid #c9a07a;"></td>
          <td style="width:8px;text-align:center;font-size:11px;color:#c9a07a;padding:0 6px;">✦</td>
          <td style="border-top:1px solid #c9a07a;"></td>
        </tr>
      </table>
    </td></tr>

    <!-- Product form blocks -->
    ${formBlocks}

    <!-- Gap before footer -->
    <tr><td style="height:40px;"></td></tr>

    <!-- Footer -->
    <tr><td class="email-pad" style="padding:24px 44px 28px;border-top:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;">M O I</p>
            <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#5c504a;">XoXo, Moi.&#x1F48B;</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;">anything else? <a href="mailto:hello@buy-moi.com" style="color:#1a1714;text-decoration:underline;">hello@buy-moi.com</a></p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;">
              <a href="${siteUrl}" style="color:#b0a89e;text-decoration:none;letter-spacing:0.1em;">buy-moi.com</a>
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c9a07a;">
              reply &amp; I'll actually read it 🌸
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Bottom accent: gold → dark -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  const productText = products.length > 0
    ? products.map((p) => {
        const link = productLink(siteUrl, p.slug);
        return `  ${p.name}\n  Leave your review → ${link}?review=true&email=${encodeURIComponent(customerEmail)}&orderId=${encodeURIComponent(orderId)}`;
      }).join("\n\n")
    : `  Leave your review → ${siteUrl}/shop`;

  const text = [
    `okay ${firstName} — she arrived. now spill. 🌸 — Moi`,
    "",
    `she landed yesterday and honestly? we haven't stopped thinking about you two.`,
    `tell us everything — the fit, the feel, the way she made you feel. we want the full tea.`,
    "",
    productText,
    "",
    "XoXo, Moi. 💋",
    "buy-moi.com",
  ].join("\n");

  return { html, text, subject };
}

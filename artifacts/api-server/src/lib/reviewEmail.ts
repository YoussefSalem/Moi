import { getSiteUrl } from "./siteUrl.js";
import { generateReviewToken } from "./reviewToken.js";

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

const STAR_LABELS: Record<number, string> = {
  1: "not great",
  2: "meh",
  3: "okay",
  4: "loved it",
  5: "obsessed",
};

// ─────────────────────────────────────────────────────────────────────────────
// Standard HTML form block (per product)
// ─────────────────────────────────────────────────────────────────────────────
//
// Star rating approach:
//   - Inputs and labels are INTERLEAVED in reverse order (5→1) inside an
//     RTL container. This lets CSS `input:checked ~ label` colour only the
//     stars to the visual LEFT of the selected star without `:has()`.
//   - Inputs are hidden via the `.sr` class defined in the <style> block.
//   - Gmail strips <style>, so the interactive stars won't work there —
//     the prominent quick-rate fallback links handle Gmail readers.
//   - Apple Mail (iOS/macOS 15.4+), Yahoo Mail, and Outlook.com all
//     support the <style> block and render the interactive stars correctly.
// ─────────────────────────────────────────────────────────────────────────────
function buildProductForm(
  product: ReviewEmailProduct,
  orderId: string,
  email: string,
  customerId: string,
  customerName: string,
  siteUrl: string
): string {
  const formAction = `${siteUrl}/api/review-email/submit`;
  const firstName = customerName ? customerName.split(" ")[0] : "love";
  const pid = (product.id.replace(/[^a-z0-9]/gi, "") || "p").slice(0, 16);
  const token = generateReviewToken(product.slug, email, orderId);

  // Reverse-order interleaved inputs + labels for the CSS ~ trick
  const starRows = [5, 4, 3, 2, 1]
    .map(
      (v) => `
      <input class="sr" type="radio" name="rating" id="s${v}_${pid}" value="${v}" />
      <label class="sl" for="s${v}_${pid}" title="${v} star${v !== 1 ? "s" : ""} — ${STAR_LABELS[v]}">&#9733;</label>`
    )
    .join("");

  // Single-click fallback links for Gmail (no form rendering)
  const quickLinks = [1, 2, 3, 4, 5]
    .map((v) => {
      const url = `${siteUrl}/api/review-email/quick-rate?handle=${encodeURIComponent(product.slug)}&email=${encodeURIComponent(email)}&orderId=${encodeURIComponent(orderId)}&rating=${v}&token=${token}`;
      const stars = "★".repeat(v) + "☆".repeat(5 - v);
      return `<a href="${url}" target="_blank" style="display:inline-block;margin:0 3px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#c9a07a;white-space:nowrap;">${stars}&nbsp;${STAR_LABELS[v]}</a>`;
    })
    .join("<br />\n      ");

  const websiteReviewUrl = `${siteUrl}/products/${product.slug}#write-review`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td class="email-pad" style="padding:0 44px;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
    <tr>
      <td style="border-left:2px solid #c9a07a;padding-left:12px;">
        <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#c9a07a;font-weight:700;">your piece ✦</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;color:#1a1714;font-weight:400;line-height:1.2;">${product.name}</p>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="form-card" style="background:#fffaf7;border:1px solid #e8ddd6;border-top:2px solid #c9a07a;">
  <tr><td style="padding:26px 22px 24px;">

    <form action="${formAction}" method="POST" target="_blank" accept-charset="UTF-8">
      <input type="hidden" name="productHandle" value="${product.slug}" />
      <input type="hidden" name="productId"     value="${product.id}" />
      <input type="hidden" name="email"         value="${email}" />
      <input type="hidden" name="orderId"       value="${orderId}" />
      <input type="hidden" name="customerId"    value="${customerId}" />
      <input type="hidden" name="token"         value="${token}" />

      <!-- ── Star rating ── -->
      <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;text-align:center;">tap your rating</p>
      <p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;color:#7a6e64;text-align:center;line-height:1.5;">select a star, then fill in the rest ↓</p>

      <!--
        RTL container — inputs and labels interleaved in reverse order (5-1).
        CSS input:checked ~ label colours every label after the checked input
        in the DOM, which in RTL display is every star to its visual left.
        Selecting star 3 fills stars 1-3. No :has(), no modern selectors.
      -->
      <div style="direction:rtl;unicode-bidi:bidi-override;text-align:center;padding:6px 0 16px;font-size:0;line-height:0;">
        ${starRows}
      </div>

      <div style="border-top:1px solid #f0e0d6;margin-bottom:20px;"></div>

      <!-- ── Name ── -->
      <div style="margin-bottom:16px;">
        <label for="author_${pid}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:6px;">your name, lovely</label>
        <input
          type="text"
          id="author_${pid}"
          name="author"
          value="${firstName}"
          maxlength="80"
          placeholder="how should we credit you?"
          style="width:100%;box-sizing:border-box;padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:transparent;border:none;border-bottom:1px solid #d4c8be;outline:none;-webkit-appearance:none;appearance:none;"
        />
      </div>

      <!-- ── Title ── -->
      <div style="margin-bottom:16px;">
        <label for="title_${pid}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:6px;">give it a headline ✨</label>
        <input
          type="text"
          id="title_${pid}"
          name="title"
          maxlength="200"
          placeholder="in three words or less..."
          style="width:100%;box-sizing:border-box;padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:transparent;border:none;border-bottom:1px solid #d4c8be;outline:none;-webkit-appearance:none;appearance:none;"
        />
      </div>

      <!-- ── Body ── -->
      <div style="margin-bottom:24px;">
        <label for="body_${pid}" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:6px;">now spill, babe 💬</label>
        <textarea
          id="body_${pid}"
          name="body"
          rows="4"
          maxlength="2000"
          placeholder="the fit, the feel, the way she made you feel — we want everything 🤍"
          style="width:100%;box-sizing:border-box;padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1714;background:#ffffff;border:1px solid #e2d8d0;outline:none;resize:vertical;-webkit-appearance:none;appearance:none;line-height:1.7;"
        ></textarea>
      </div>

      <!-- ── Submit ── -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="text-align:center;">
            <button
              type="submit"
              style="background:#1a1714;color:#ffffff;border:none;padding:14px 52px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.42em;text-transform:uppercase;cursor:pointer;-webkit-appearance:none;appearance:none;display:inline-block;"
            >share the love 💌</button>
          </td>
        </tr>
      </table>

    </form>

    <!-- ── Fallback: website link + quick-rate links for Gmail ── -->
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid #f0e0d6;text-align:center;">

      <!-- Primary fallback: link to the website review form -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
        <tr>
          <td style="text-align:center;">
            <a href="${websiteReviewUrl}" target="_blank"
               style="display:inline-block;background:#fffaf7;color:#1a1714;text-decoration:none;padding:10px 28px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.38em;text-transform:uppercase;border:1px solid #c9a07a;">
              write review on the website
            </a>
          </td>
        </tr>
      </table>

      <!-- Secondary fallback: single-click rating links for clients that strip forms -->
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;line-height:1.7;">
        or just tap a star — one click&nbsp;&amp;&nbsp;you're done:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr><td style="padding:2px 0;line-height:1.9;font-size:11px;text-align:center;">
          ${quickLinks}
        </td></tr>
      </table>

    </div>

  </td></tr>
  </table>

</td></tr>
</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AMP for Email form block (per product)
// ─────────────────────────────────────────────────────────────────────────────
function buildAmpProductForm(
  product: ReviewEmailProduct,
  orderId: string,
  email: string,
  customerId: string,
  customerName: string,
  siteUrl: string
): string {
  const formAction = `${siteUrl}/api/review-email/submit?format=amp`;
  const firstName = customerName ? customerName.split(" ")[0] : "love";
  const pid = (product.id.replace(/[^a-z0-9]/gi, "") || "p").slice(0, 16);
  const token = generateReviewToken(product.slug, email, orderId);
  const websiteReviewUrl = `${siteUrl}/products/${product.slug}#write-review`;

  const starRows = [5, 4, 3, 2, 1]
    .map(
      (v) => `
        <input class="sr" type="radio" name="rating" id="as${v}_${pid}" value="${v}" />
        <label class="sl" for="as${v}_${pid}" title="${v} star${v !== 1 ? "s" : ""} — ${STAR_LABELS[v]}">&#9733;</label>`
    )
    .join("");

  return `
    <div class="product-block">
      <div class="product-label">
        <span class="product-eyebrow">your piece ✦</span>
        <span class="product-name">${product.name}</span>
      </div>

      <div class="form-card">
        <amp-form action="${formAction}" method="POST" target="_blank">
          <input type="hidden" name="productHandle" value="${product.slug}" />
          <input type="hidden" name="productId"     value="${product.id}" />
          <input type="hidden" name="email"         value="${email}" />
          <input type="hidden" name="orderId"       value="${orderId}" />
          <input type="hidden" name="customerId"    value="${customerId}" />
          <input type="hidden" name="token"         value="${token}" />

          <div class="field-group">
            <p class="field-eyebrow">tap your rating</p>
            <p class="field-sub">select a star, then fill in the rest ↓</p>
            <div class="stars-wrap">
              ${starRows}
            </div>
          </div>

          <hr class="divider" />

          <div class="field-group">
            <label class="field-label" for="amp_author_${pid}">your name, lovely</label>
            <input class="field-input" type="text" id="amp_author_${pid}" name="author"
                   value="${firstName}" maxlength="80" placeholder="how should we credit you?" />
          </div>

          <div class="field-group">
            <label class="field-label" for="amp_title_${pid}">give it a headline ✨</label>
            <input class="field-input" type="text" id="amp_title_${pid}" name="title"
                   maxlength="200" placeholder="in three words or less..." />
          </div>

          <div class="field-group">
            <label class="field-label" for="amp_body_${pid}">now spill, babe 💬</label>
            <textarea class="field-textarea" id="amp_body_${pid}" name="body"
                      rows="4" maxlength="2000"
                      placeholder="the fit, the feel, the way she made you feel — we want everything 🤍"></textarea>
          </div>

          <div class="submit-row">
            <input class="submit-btn" type="submit" value="share the love 💌" />
          </div>

          <div submit-success>
            <template type="amp-mustache">
              <div class="amp-success">
                <p>thank you, genuinely. 🤍</p>
                <p style="font-size:11px;color:#5c504a;">your review is in — we'll be reading it, promise.</p>
              </div>
            </template>
          </div>

          <div submit-error>
            <template type="amp-mustache">
              <div class="amp-error">
                <p>something went sideways 😬</p>
                <p style="font-size:11px;">
                  <a href="${websiteReviewUrl}" style="color:#c9a07a;">write your review on the website</a>
                </p>
              </div>
            </template>
          </div>
        </amp-form>

        <div class="fallback-row">
          <a href="${websiteReviewUrl}" class="website-btn">write review on the website</a>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard HTML email
// ─────────────────────────────────────────────────────────────────────────────
export function buildReviewEmail(params: {
  customerName: string;
  orderId: string;
  customerEmail: string;
  customerId?: string;
  products: ReviewEmailProduct[];
  siteUrl?: string;
}): { html: string; ampHtml: string; text: string; subject: string } {
  const { customerName, orderId, customerEmail, products } = params;
  const customerId = params.customerId ?? "";
  const siteUrl = params.siteUrl ?? getSiteUrl();
  const firstName = customerName ? customerName.split(" ")[0] : "gorgeous";
  const subject = pickSubject(customerName, orderId);

  const productList = products.length > 0
    ? products
    : [{ name: "your Moi piece", slug: "shop", id: "default" }];

  const formBlocks = productList
    .map((p) => buildProductForm(p, orderId, customerEmail, customerId, customerName, siteUrl))
    .join(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:28px;"></td></tr></table>`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Moi — spill it 🌸</title>
<style>
:root { color-scheme: light; }

/*
  Star rating — hidden radio + visible label trick.
  Inputs are hidden but remain in the DOM so checked state is
  serialised in the form POST. Labels are the visible stars.
  RTL container + interleaved DOM order (5-1) lets the sibling
  combinator (~) fill only the stars to the visual left of the
  selected one. No :has(), no modern selectors required.
  Gmail strips style blocks from HTML; AMP part handles Gmail.
*/
.sr { display:none!important; }

.sl {
  display:inline-block!important;
  cursor:pointer!important;
  font-size:34px!important;
  line-height:1.1!important;
  padding:3px 4px!important;
  color:#d9cec7!important;
  font-family:Arial,Helvetica,sans-serif!important;
  font-style:normal!important;
  -webkit-user-select:none!important;
  user-select:none!important;
  transition:color 0.1s!important;
}

/* Fill all labels that follow a checked input (via RTL, these are the stars to its left visually) */
.sr:checked ~ .sl { color:#c9a07a!important; }

/* Hover — only in clients that support :hover (Apple Mail, Yahoo) */
.sl:hover,
.sl:hover ~ .sl { color:#c9a07a!important; }

/* Dark mode — keep warm palette readable on dark backgrounds */
@media (prefers-color-scheme:dark) {
  body,.email-body { background-color:#e8e3dc!important;color:#1a1714!important; }
  .email-card      { background-color:#ffffff!important; }
  .form-card       { background-color:#fffaf7!important; }
  .sl              { color:#9e9189!important; }
  .sr:checked ~ .sl { color:#c9a07a!important; }
  input[type="text"],textarea { background-color:#ffffff!important;color:#1a1714!important;border-color:#d4c8be!important; }
}

@media screen and (max-width:480px) {
  .email-card { width:100%!important; }
  .email-pad  { padding-left:20px!important;padding-right:20px!important; }
  .sl         { font-size:28px!important;padding:2px 3px!important; }
}
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;color-scheme:light;">

<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">fill in the form below — it takes 30 seconds, promise 🌸&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <table role="presentation" width="560" class="email-card" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top gradient bar -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td class="email-pad" style="padding:28px 44px 24px;border-bottom:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;letter-spacing:0.14em;color:#1a1714;font-weight:400;">MOI</span>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.38em;text-transform:uppercase;color:#c9a07a;">Order&nbsp;#${orderId}</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero copy -->
    <tr><td class="email-pad" style="padding:40px 44px 10px;">
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:27px;font-weight:400;color:#1a1714;line-height:1.28;letter-spacing:-0.01em;">
        okay ${firstName} —<br />she arrived. spill. 🌸
      </h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.85;color:#5c504a;">
        fill in the form below — it takes 30 seconds, promise. your review helps other girls find their next favourite piece 🤍
      </p>
    </td></tr>

    <!-- Gold divider -->
    <tr><td class="email-pad" style="padding:26px 44px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:40px;border-top:1px solid #c9a07a;"></td>
          <td style="width:8px;text-align:center;font-size:11px;color:#c9a07a;padding:0 6px;font-family:Arial,Helvetica,sans-serif;">✦</td>
          <td style="border-top:1px solid #c9a07a;"></td>
        </tr>
      </table>
    </td></tr>

    <!-- Product form(s) -->
    ${formBlocks}

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
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;"><a href="${siteUrl}" style="color:#b0a89e;text-decoration:none;letter-spacing:0.1em;">buy-moi.com</a></p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c9a07a;">reply &amp; I'll actually read it 🌸</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Bottom gradient bar -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  // ─── AMP for Email ─────────────────────────────────────────────────────────
  //
  // Gmail renders this MIME part (text/x-amp-html) when the email passes
  // AMP validation and the sender domain is whitelisted (or the recipient
  // has enabled dynamic email in Gmail settings).
  //
  // Differences from standard HTML version:
  //   • <amp-form> handles submission; success/error shown inline.
  //   • CSS `~` star trick works in Gmail via <style amp-custom>.
  //   • amp-mustache renders the inline success/error templates.
  //   • The form action must respond with JSON and AMP CORS headers.
  // ─────────────────────────────────────────────────────────────────────────

  const ampFormBlocks = productList
    .map((p) => buildAmpProductForm(p, orderId, customerEmail, customerId, customerName, siteUrl))
    .join(`<hr style="border:none;border-top:1px solid #e8ddd6;margin:24px 0;" />`);

  const ampHtml = `<!doctype html>
<html ⚡4email data-css-strict>
<head>
<meta charset="UTF-8" />
<script async src="https://cdn.ampproject.org/v0.js"></script>
<script async custom-element="amp-form" src="https://cdn.ampproject.org/v0/amp-form-0.1.js"></script>
<script async custom-template="amp-mustache" src="https://cdn.ampproject.org/v0/amp-mustache-0.2.js"></script>
<style amp4email-boilerplate>body{visibility:hidden}</style>
<style amp-custom>
/* ── Layout ── */
body {
  margin:0;padding:0;background:#e8e3dc;
  font-family:Arial,Helvetica,sans-serif;
  color:#1a1714;
}
.wrap { max-width:560px;margin:0 auto;padding:32px 16px 48px; }
.card { background:#ffffff; }
.bar-top { background:linear-gradient(to right,#c9a07a,#1a1714);height:3px; }
.bar-bot { background:linear-gradient(to right,#c9a07a,#1a1714);height:2px; }

.header { padding:24px 36px;border-bottom:1px solid #ede9e3; }
.logo   { font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;letter-spacing:0.14em;color:#1a1714; }
.order-ref { font-size:9px;letter-spacing:0.38em;text-transform:uppercase;color:#c9a07a; }

.hero   { padding:36px 36px 10px; }
.hero h1 { margin:0 0 12px;font-family:Georgia,'Times New Roman',Times,serif;font-size:24px;font-weight:400;color:#1a1714;line-height:1.28; }
.hero p  { margin:0;font-size:13px;line-height:1.85;color:#5c504a; }

.divider-gold { padding:20px 36px; }
.divider-gold hr { border:none;border-top:1px solid #c9a07a;margin:0; }

.product-block { padding:0 36px 8px; }
.product-label { border-left:2px solid #c9a07a;padding-left:12px;margin-bottom:18px; }
.product-eyebrow { display:block;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:2px; }
.product-name   { display:block;font-family:Georgia,'Times New Roman',Times,serif;font-size:19px;color:#1a1714;line-height:1.2; }

.form-card { background:#fffaf7;border:1px solid #e8ddd6;border-top:2px solid #c9a07a;padding:22px 18px 20px; }

/* ── Star rating (same RTL interleaved trick) ── */
.sr { display:none; }
.sl {
  display:inline-block;
  cursor:pointer;
  font-size:32px;
  line-height:1.1;
  padding:3px 4px;
  color:#d9cec7;
  font-style:normal;
}
.sr:checked ~ .sl { color:#c9a07a; }

.stars-wrap {
  direction:rtl;
  unicode-bidi:bidi-override;
  text-align:center;
  padding:6px 0 16px;
  font-size:0;
  line-height:0;
}
.field-eyebrow { margin:0 0 4px;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;text-align:center; }
.field-sub     { margin:0 0 12px;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;color:#7a6e64;text-align:center;line-height:1.5; }

.divider { border:none;border-top:1px solid #f0e0d6;margin:0 0 18px; }

.field-group  { margin-bottom:16px; }
.field-label  { display:block;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;margin-bottom:6px; }
.field-input  { width:100%;box-sizing:border-box;padding:8px 0;font-size:13px;color:#1a1714;background:transparent;border:none;border-bottom:1px solid #d4c8be;outline:none; }
.field-textarea { width:100%;box-sizing:border-box;padding:10px 12px;font-size:13px;color:#1a1714;background:#ffffff;border:1px solid #e2d8d0;outline:none;resize:vertical;line-height:1.7; }

.submit-row  { text-align:center;margin-top:20px; }
.submit-btn  { background:#1a1714;color:#ffffff;border:none;padding:14px 48px;font-size:10px;font-weight:700;letter-spacing:0.42em;text-transform:uppercase;cursor:pointer;display:inline-block; }

.amp-success { padding:16px;background:#f8f4f0;border-left:2px solid #c9a07a;margin-top:16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#1a1714;text-align:center; }
.amp-error   { padding:16px;background:#fff5f5;border-left:2px solid #e07070;margin-top:16px;font-size:13px;color:#5c504a;text-align:center; }

.fallback-row { margin-top:18px;padding-top:16px;border-top:1px solid #f0e0d6;text-align:center; }
.website-btn  { display:inline-block;background:#fffaf7;color:#1a1714;text-decoration:none;padding:10px 24px;font-size:9px;font-weight:700;letter-spacing:0.38em;text-transform:uppercase;border:1px solid #c9a07a; }

.footer { padding:22px 36px 26px;border-top:1px solid #ede9e3; }
.footer-brand { font-size:9px;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:#1a1714;margin:0 0 4px; }
.footer-xoxo  { font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#5c504a;margin:0 0 6px; }
.footer-link  { font-size:11px;color:#b0a89e;margin:0; }
.footer-link a { color:#1a1714;text-decoration:underline; }
</style>
</head>
<body>
<div class="wrap">
<div class="card">
  <div class="bar-top"></div>

  <div class="header">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td><span class="logo">MOI</span></td>
        <td style="text-align:right;vertical-align:middle;"><span class="order-ref">Order #${orderId}</span></td>
      </tr>
    </table>
  </div>

  <div class="hero">
    <h1>okay ${firstName} —<br />she arrived. spill. 🌸</h1>
    <p>fill in the form below — it takes 30 seconds, promise. your review helps other girls find their next favourite piece 🤍</p>
  </div>

  <div class="divider-gold"><hr /></div>

  ${ampFormBlocks}

  <div style="height:32px;"></div>

  <div class="footer">
    <p class="footer-brand">M O I</p>
    <p class="footer-xoxo">XoXo, Moi.💋</p>
    <p class="footer-link">anything else? <a href="mailto:hello@buy-moi.com">hello@buy-moi.com</a></p>
  </div>

  <div class="bar-bot"></div>
</div>
</div>
</body>
</html>`;

  // ─── Plain text fallback ───────────────────────────────────────────────────
  const productText = productList
    .map((p) => {
      const token = generateReviewToken(p.slug, customerEmail, orderId);
      const base = `${siteUrl}/api/review-email/quick-rate?handle=${encodeURIComponent(p.slug)}&email=${encodeURIComponent(customerEmail)}&orderId=${encodeURIComponent(orderId)}&token=${token}`;
      return [
        `  ${p.name}`,
        [5, 4, 3, 2, 1]
          .map((v) => `  ${"★".repeat(v)}${"☆".repeat(5 - v)} ${STAR_LABELS[v]} → ${base}&rating=${v}`)
          .join("\n"),
        `  Or write your full review: ${siteUrl}/products/${p.slug}#write-review`,
      ].join("\n");
    })
    .join("\n\n");

  const text = [
    `okay ${firstName} — she arrived. spill. 🌸`,
    "",
    "tap a star rating below, or open the email to fill in the full form:",
    "",
    productText,
    "",
    "XoXo, Moi. 💋",
  ].join("\n");

  return { html, ampHtml, text, subject };
}

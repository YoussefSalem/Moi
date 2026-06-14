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
  return slug ? `${siteUrl}/products/${slug}` : `${siteUrl}/shop`;
}

// Emoji mood map — 1 = terrible → 5 = obsessed
const MOODS = [
  { value: 1, emoji: "😡", label: "terrible" },
  { value: 2, emoji: "😕", label: "meh" },
  { value: 3, emoji: "😐", label: "okay" },
  { value: 4, emoji: "🙂", label: "loved it" },
  { value: 5, emoji: "😍", label: "obsessed" },
] as const;

function buildProductSection(
  product: ReviewEmailProduct,
  orderId: string,
  email: string,
  customerName: string,
  siteUrl: string
): string {
  const firstName = customerName ? customerName.split(" ")[0] : "love";
  const base = productLink(siteUrl, product.slug);
  const sharedParams = `writeReview=1&email=${encodeURIComponent(email)}&name=${encodeURIComponent(firstName)}&orderId=${encodeURIComponent(orderId)}`;
  const fullReviewLink = `${base}?${sharedParams}`;

  const emojiCells = MOODS.map(({ value, emoji, label }) => {
    const url = `${base}?${sharedParams}&rating=${value}`;
    return `
<td style="text-align:center;padding:0 5px;">
  <a href="${url}" target="_blank" style="display:block;text-decoration:none;width:54px;height:54px;border-radius:50%;border:1.5px solid #ddd5cc;text-align:center;line-height:52px;font-size:26px;-webkit-filter:grayscale(1) contrast(0.85);filter:grayscale(1) contrast(0.85);box-sizing:border-box;mso-text-raise:0;">${emoji}</a>
  <p style="margin:7px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#b0a89e;text-align:center;">${label}</p>
</td>`;
  }).join("\n");

  return `
<!-- ── Product: ${product.name} ── -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr><td class="email-pad" style="padding:0 44px;">

  <!-- Product name label -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="border-left:2px solid #c9a07a;padding-left:12px;">
        <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#c9a07a;font-weight:700;">your piece ✦</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;color:#1a1714;font-weight:400;line-height:1.2;">${product.name}</p>
      </td>
    </tr>
  </table>

  <!-- Mood card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="form-card" style="background:#fffaf7;border:1px solid #e8ddd6;border-top:2px solid #c9a07a;">
  <tr><td style="padding:28px 20px 26px;text-align:center;">

    <!-- Question -->
    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#c9a07a;font-weight:700;">how did she make you feel?</p>
    <p style="margin:0 0 26px;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#7a6e64;line-height:1.6;">tap once to send your review ↓</p>

    <!-- Emoji row -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>${emojiCells}</tr>
    </table>

    <!-- Thin separator -->
    <div style="border-top:1px solid #f0e0d6;margin:26px 0 18px;"></div>

    <!-- Secondary CTA -->
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b0a89e;line-height:1.8;">
      want to write more? —
      <a href="${fullReviewLink}" target="_blank" style="color:#1a1714;text-decoration:underline;">leave a full review 🤍</a>
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

  const sections = products.length > 0
    ? products.map((p) => buildProductSection(p, orderId, customerEmail, customerName, siteUrl)).join(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:28px;"></td></tr></table>`
      )
    : buildProductSection(
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
<meta name="supported-color-schemes" content="light" />
<title>Moi — how did she do? 🌸</title>
<style>
/* Force light mode (Apple Mail dark-mode guard) */
:root { color-scheme: light; }

/* ── Dark mode overrides ──────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  body, .email-body          { background-color: #e8e3dc !important; color: #1a1714 !important; }
  .email-card                { background-color: #ffffff !important; }
  .form-card                 { background-color: #fffaf7 !important; }
  .mood-btn                  { border-color: #bdb5ae !important; background-color: transparent !important; }
  h1, h2, h3, p, span, td, a { color: inherit !important; }
}

@media screen and (max-width: 480px) {
  .email-card  { width: 100% !important; }
  .email-pad   { padding-left: 20px !important; padding-right: 20px !important; }
  .mood-btn    { width: 46px !important; height: 46px !important; line-height: 44px !important; font-size: 22px !important; }
}
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;color-scheme:light;">

<!-- Hidden preheader -->
<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">tap once to send your review — no login, no hassle 🌸&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- ── Email Card ─────────────────────────────────────── -->
  <table role="presentation" width="560" class="email-card" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Gold → dark top bar -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td class="email-pad" style="padding:28px 44px 24px;border-bottom:1px solid #ede9e3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <a href="${siteUrl}" style="text-decoration:none;">
              <span style="font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;letter-spacing:0.14em;color:#1a1714;font-weight:400;">MOI</span>
            </a>
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
        okay ${firstName} —<br />she arrived. 🌸
      </h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.85;color:#5c504a;">
        she's been with you long enough to form an opinion. tap once below and we'll take care of the rest — your review goes live and helps your fellow girls find their next favourite piece.
      </p>
    </td></tr>

    <!-- Decorative gold divider -->
    <tr><td class="email-pad" style="padding:26px 44px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:40px;border-top:1px solid #c9a07a;"></td>
          <td style="width:8px;text-align:center;font-size:11px;color:#c9a07a;padding:0 6px;font-family:Arial,Helvetica,sans-serif;">✦</td>
          <td style="border-top:1px solid #c9a07a;"></td>
        </tr>
      </table>
    </td></tr>

    <!-- Product section(s) -->
    ${sections}

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
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c9a07a;">reply &amp; I'll actually read it 🌸</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Gold → dark bottom bar -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  const productText = products.length > 0
    ? products.map((p) => {
        const base = productLink(siteUrl, p.slug);
        const sharedParams = `writeReview=1&email=${encodeURIComponent(customerEmail)}&name=${encodeURIComponent(firstName)}&orderId=${encodeURIComponent(orderId)}`;
        return MOODS.map(({ value, emoji, label }) =>
          `  ${emoji} ${label} (${value}/5) → ${base}?${sharedParams}&rating=${value}`
        ).join("\n");
      }).join("\n\n")
    : `  Review → ${siteUrl}/shop`;

  const text = [
    `okay ${firstName} — she arrived. 🌸 — Moi`,
    "",
    `tap an emoji below to send your review:`,
    "",
    productText,
    "",
    "XoXo, Moi. 💋",
    "buy-moi.com",
  ].join("\n");

  return { html, text, subject };
}

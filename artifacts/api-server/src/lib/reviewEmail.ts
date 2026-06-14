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

// Emoji mood map (1 = terrible → 5 = obsessed)
const MOODS = [
  { value: 1, emoji: "😡", label: "terrible" },
  { value: 2, emoji: "😕", label: "meh" },
  { value: 3, emoji: "😐", label: "okay" },
  { value: 4, emoji: "🙂", label: "loved it" },
  { value: 5, emoji: "😍", label: "obsessed" },
] as const;

function buildProductForm(
  product: ReviewEmailProduct,
  orderId: string,
  email: string,
  customerName: string,
  siteUrl: string
): string {
  const formAction = `${siteUrl}/api/review-email/submit`;
  const firstName = customerName ? customerName.split(" ")[0] : "love";
  const pid = product.id.replace(/[^a-z0-9]/gi, "") || "p";
  const token = generateReviewToken(product.slug, email, orderId);

  // Gmail fallback: single-click GET links (no form required)
  const quickRateCells = MOODS.map(({ value, emoji, label }) => {
    const url = `${siteUrl}/api/review-email/quick-rate?handle=${encodeURIComponent(product.slug)}&email=${encodeURIComponent(email)}&orderId=${encodeURIComponent(orderId)}&rating=${value}&token=${token}`;
    return `<td style="text-align:center;padding:0 10px;vertical-align:top;">
  <a href="${url}" target="_blank" style="display:block;text-decoration:none;text-align:center;">
    <span style="display:block;font-size:28px;line-height:1;margin-bottom:6px;">${emoji}</span>
    <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:#b0a89e;">${label}</span>
  </a>
</td>`;
  }).join("\n");

  // Fixed-width cells (76px each × 5 = 380px) ensures perfectly even spacing.
  // The emoji span has a fixed height (40px line-height) so growing the font-size
  // on :checked doesn't shift the layout — the container stays the same height.
  const emojiCells = MOODS.map(({ value, emoji, label }) => `
<td style="text-align:center;padding:0;width:76px;vertical-align:top;">
  <input
    class="emi"
    type="radio"
    name="rating"
    value="${value}"
    id="em${value}_${pid}"
    ${value === 1 ? "required" : ""}
    style="display:block;margin:0 auto 10px;width:18px;height:18px;cursor:pointer;accent-color:#c9a07a;"
  />
  <label
    for="em${value}_${pid}"
    class="eml"
    title="${label}"
    style="display:block;cursor:pointer;text-align:center;padding:10px 4px 12px;border-radius:12px;border:1.5px solid transparent;box-sizing:border-box;"
  >
    <span class="eml-emoji" style="display:block;font-size:28px;line-height:40px;height:40px;margin-bottom:8px;text-align:center;">${emoji}</span>
    <span class="eml-text" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:#b0a89e;line-height:1.4;">${label}</span>
  </label>
</td>`).join("\n");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td class="email-pad" style="padding:0 44px;">

  <!-- Product name label -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
    <tr>
      <td style="border-left:2px solid #c9a07a;padding-left:12px;">
        <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#c9a07a;font-weight:700;">your piece ✦</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;color:#1a1714;font-weight:400;line-height:1.2;">${product.name}</p>
      </td>
    </tr>
  </table>

  <!-- Review card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="form-card" style="background:#fffaf7;border:1px solid #e8ddd6;border-top:2px solid #c9a07a;">
  <tr><td style="padding:26px 22px 24px;">

    <form action="${formAction}" method="POST" target="_blank" accept-charset="UTF-8">
      <input type="hidden" name="productHandle" value="${product.slug}" />
      <input type="hidden" name="email" value="${email}" />
      <input type="hidden" name="orderId" value="${orderId}" />

      <!-- ── Emoji mood selector ── -->
      <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;text-align:center;">how did she make you feel?</p>
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;color:#7a6e64;text-align:center;line-height:1.5;">tap to select your mood, then fill in the rest ↓</p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>${emojiCells}</tr>
      </table>

      <!-- ── Divider ── -->
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

    <!-- ── Gmail fallback ── -->
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid #f0e0d6;">
      <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#b0a89e;text-align:center;line-height:1.7;">buttons not working? (common on Gmail)<br />tap directly to rate — one click &amp; you're done:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>${quickRateCells}</tr>
      </table>
    </div>

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
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:28px;"></td></tr></table>`
      )
    : buildProductForm(
        { name: "your Moi piece", slug: "shop", id: "default" },
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
<title>Moi — spill it 🌸</title>
<style>
:root { color-scheme: light; }

/* Visible native radio inputs with gold accent color */
.emi { display:block!important;margin:0 auto 10px!important;width:18px!important;height:18px!important;cursor:pointer!important;accent-color:#c9a07a!important; }

/* Emoji option label — card container, consistent height */
.eml { display:block!important;cursor:pointer!important;text-align:center!important;padding:10px 4px 12px!important;border-radius:12px!important;border:1.5px solid transparent!important;box-sizing:border-box!important;transition:none!important; }

/* Emoji character — fixed line-height container for stable layout */
.eml-emoji { display:block!important;font-size:28px!important;line-height:40px!important;height:40px!important;margin-bottom:8px!important;text-align:center!important; }

/* Small text label */
.eml-text { display:block!important;font-family:Arial,Helvetica,sans-serif!important;font-size:8px!important;letter-spacing:0.22em!important;text-transform:uppercase!important;color:#b0a89e!important;line-height:1.4!important; }

/* ── Selected state: subtle glow ring + warm card + bigger emoji ── */
/* Ring and glow on the card */
.emi:checked + .eml { background:rgba(201,160,122,0.08)!important;border-color:#c9a07a!important;box-shadow:0 0 0 2px rgba(201,160,122,0.25),0 4px 14px rgba(201,160,122,0.18)!important; }

/* Emoji grows within its fixed-height container */
.emi:checked + .eml .eml-emoji { font-size:36px!important;line-height:40px!important; }

/* Text turns gold */
.emi:checked + .eml .eml-text { color:#c9a07a!important;font-weight:700!important; }

/* ── Dark mode: force light colours ── */
@media (prefers-color-scheme:dark) {
  body,.email-body { background-color:#e8e3dc!important;color:#1a1714!important; }
  .email-card      { background-color:#ffffff!important; }
  .form-card       { background-color:#fffaf7!important; }
  input[type="text"],textarea { background-color:#ffffff!important;color:#1a1714!important;border-color:#d4c8be!important; }
}

@media screen and (max-width:480px) {
  .email-card  { width:100%!important; }
  .email-pad   { padding-left:20px!important;padding-right:20px!important; }
  .eml-emoji   { font-size:24px!important;line-height:34px!important;height:34px!important; }
  .emi:checked + .eml .eml-emoji { font-size:30px!important;line-height:34px!important; }
}
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#e8e3dc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;color-scheme:light;">

<div style="display:none;overflow:hidden;max-height:0;mso-hide:all;">fill in the form below — it takes 30 seconds, promise 🌸&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b&nbsp;\u200b</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e3dc;min-width:100%;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <table role="presentation" width="560" class="email-card" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">

    <!-- Top bar: gold → dark -->
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

    <!-- Bottom bar: gold → dark -->
    <tr><td style="background:linear-gradient(to right,#c9a07a,#1a1714);height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  const productText = products.length > 0
    ? products.map((p) => {
        const token = generateReviewToken(p.slug, customerEmail, orderId);
        const base = `${siteUrl}/api/review-email/quick-rate?handle=${encodeURIComponent(p.slug)}&email=${encodeURIComponent(customerEmail)}&orderId=${encodeURIComponent(orderId)}&token=${token}`;
        return MOODS.map(({ value, emoji, label }) => `  ${emoji} ${label} → ${base}&rating=${value}`).join("\n");
      }).join("\n\n")
    : "  Review your order → " + siteUrl;

  const text = [
    `okay ${firstName} — she arrived. spill. 🌸`,
    "",
    "fill in the form in this email, or tap a rating below:",
    "",
    productText,
    "",
    "XoXo, Moi. 💋",
  ].join("\n");

  return { html, text, subject };
}

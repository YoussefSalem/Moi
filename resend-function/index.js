const { Resend } = require('resend');

function buildEmailHTML(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Georgia', serif; background: #faf8f5; color: #1e1814; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .logo { font-size: 28px; letter-spacing: 0.3em; text-align: center; margin-bottom: 32px; }
    .title { font-size: 22px; font-weight: 400; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field-label { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #8a7e72; margin-bottom: 4px; }
    .field-value { font-size: 15px; }
    .divider { border: none; border-top: 1px solid rgba(180,160,140,0.3); margin: 24px 0; }
    .footer { font-size: 11px; color: #b0a090; text-align: center; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">MOI</div>
    <h1 class="title">New Ambassador Application</h1>
    <hr class="divider">
    <div class="field">
      <div class="field-label">Name</div>
      <div class="field-value">${data.firstName || ''} ${data.lastName || ''}</div>
    </div>
    <div class="field">
      <div class="field-label">Email</div>
      <div class="field-value">${data.email || ''}</div>
    </div>
    <div class="field">
      <div class="field-label">Phone / WhatsApp</div>
      <div class="field-value">${data.phone || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">Instagram</div>
      <div class="field-value">${data.instagram || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">TikTok</div>
      <div class="field-value">${data.tiktok || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">Followers</div>
      <div class="field-value">${data.followers || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">City</div>
      <div class="field-value">${data.city || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">Message</div>
      <div class="field-value">${data.message || '—'}</div>
    </div>
    <div class="footer">© Moi · hello@buy-moi.com</div>
  </div>
</body>
</html>
  `;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const data = req.body;

  if (!data.email || !data.firstName) {
    return res.status(400).json({ error: 'firstName and email are required' });
  }

  try {
    await resend.emails.send({
      from: 'ambassador@buy-moi.com',
      to: process.env.NOTIFY_EMAIL || 'hello@buy-moi.com',
      replyTo: data.email,
      subject: `New Ambassador Application — ${data.firstName} ${data.lastName || ''}`,
      html: buildEmailHTML(data),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }
};

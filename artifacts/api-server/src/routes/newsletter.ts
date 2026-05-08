import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";

const router: IRouter = Router();

interface NewsletterBody {
  email?: unknown;
}

function makeTransporter() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: apiKey },
  });
}

async function sendNewsletterConfirmationEmail(email: string) {
  const transporter = makeTransporter();
  if (!transporter) throw new Error("RESEND_API_KEY not configured");

  await transporter.sendMail({
    from: "Moi <onboarding@resend.dev>",
    to: email,
    subject: "Welcome to Moi",
    html: `
      <div style="font-family:'Montserrat',sans-serif;max-width:560px;margin:0 auto;color:#1e1814;background:#faf8f5;padding:40px 32px;border:1px solid rgba(30,24,20,0.08);">
        <div style="letter-spacing:0.35em;font-size:12px;font-weight:600;margin-bottom:28px;color:#7a6e64;">MOI</div>
        <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:42px;font-weight:500;margin:0 0 18px;line-height:1.1;">
          Thank you for subscribing.
        </h1>
        <p style="font-size:14px;line-height:1.9;color:#5a5048;margin:0 0 14px;">
          We’re so pleased to have you with us. Expect only thoughtful updates from Moi — new drops, exclusive launches, and important brand news.
        </p>
        <p style="font-size:14px;line-height:1.9;color:#5a5048;margin:0 0 14px;">
          We respect your inbox and will never spam you.
        </p>
        <p style="font-size:14px;line-height:1.9;color:#5a5048;margin:0;">
          Until then, consider this your front-row seat.
        </p>
        <div style="margin-top:34px;padding-top:20px;border-top:1px solid rgba(30,24,20,0.08);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(30,24,20,0.35);">
          Moi
        </div>
      </div>
    `,
    text: "Thank you for subscribing to Moi. We respect your inbox, will never spam you, and will only send occasional updates about new drops, exclusive launches, and important brand news.",
  });
}

router.post("/newsletter", async (req, res) => {
  const { email } = req.body as NewsletterBody;

  if (typeof email !== "string" || !email.includes("@") || email.trim().length === 0) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const safeEmail = email.trim().toLowerCase();

  req.log.info({ email: safeEmail }, "Newsletter subscription request");

  try {
    await sendNewsletterConfirmationEmail(safeEmail);
    req.log.info({ email: safeEmail }, "Newsletter confirmation sent");
  } catch (err) {
    req.log.warn({ err, email: safeEmail }, "Newsletter confirmation email failed");
  }

  res.status(200).json({ success: true });
});

export default router;

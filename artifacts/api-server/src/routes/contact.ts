import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";

const router: IRouter = Router();

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
}

router.post("/contact", async (req, res) => {
  const { name, email, message } = req.body as ContactBody;

  if (
    typeof name !== "string" || name.trim().length === 0 ||
    typeof email !== "string" || !email.includes("@") ||
    typeof message !== "string" || message.trim().length === 0
  ) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safeMessage = message.trim();

  req.log.info(
    { name: safeName, email: safeEmail, messageLength: safeMessage.length },
    "Contact form submission",
  );

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_EMAIL_TO } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS && CONTACT_EMAIL_TO) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
        secure: SMTP_PORT === "465",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      await transporter.sendMail({
        from: `"Moi Contact" <${SMTP_USER}>`,
        to: CONTACT_EMAIL_TO,
        replyTo: safeEmail,
        subject: `Contact form — ${safeName}`,
        text: `From: ${safeName} <${safeEmail}>\n\n${safeMessage}`,
        html: `<p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p><p>${safeMessage.replace(/\n/g, "<br>")}</p>`,
      });

      req.log.info({ to: CONTACT_EMAIL_TO }, "Contact email sent");
    } catch (err) {
      req.log.warn({ err }, "SMTP send failed — logged only");
    }
  }

  res.status(200).json({ success: true });
});

export default router;

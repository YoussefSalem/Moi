import { Router, type IRouter } from "express";
import { sendEmail } from "../lib/email";

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

  const contactTo = process.env.CONTACT_EMAIL_TO;
  if (contactTo) {
    try {
      await sendEmail({
        to: contactTo,
        replyTo: safeEmail,
        subject: `Contact form — ${safeName}`,
        text: `From: ${safeName} <${safeEmail}>\n\n${safeMessage}`,
        html: `<p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p><p>${safeMessage.replace(/\n/g, "<br>")}</p>`,
      });
      req.log.info({ to: contactTo }, "Contact email sent");
    } catch (err) {
      req.log.warn({ err }, "Contact email send failed — logged only");
    }
  }

  res.status(200).json({ success: true });
});

export default router;

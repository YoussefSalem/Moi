import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";

const router: IRouter = Router();

interface AmbassadorBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  facebook?: unknown;
  instagram?: unknown;
  about?: unknown;
}

router.post("/ambassador", async (req, res) => {
  const { name, email, phone, facebook, instagram, about } =
    req.body as AmbassadorBody;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof email !== "string" ||
    !email.includes("@")
  ) {
    res.status(400).json({ error: "Name and email are required." });
    return;
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safePhone = typeof phone === "string" ? phone.trim() : "";
  const safeFacebook = typeof facebook === "string" ? facebook.trim() : "";
  const safeInstagram = typeof instagram === "string" ? instagram.trim() : "";
  const safeAbout = typeof about === "string" ? about.trim() : "";

  req.log.info({ name: safeName, email: safeEmail }, "Ambassador application received");

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, AMBASSADOR_EMAIL_TO } =
    process.env;

  const emailTo = AMBASSADOR_EMAIL_TO ?? "youssefasalem@gmail.com";

  if (SMTP_USER && SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST ?? "smtp.gmail.com",
        port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
        secure: SMTP_PORT === "465",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const textLines = [
        `Ambassador Application`,
        ``,
        `Name:      ${safeName}`,
        `Email:     ${safeEmail}`,
        safePhone ? `Phone:     ${safePhone}` : "",
        safeFacebook ? `Facebook:  ${safeFacebook}` : "",
        safeInstagram ? `Instagram: ${safeInstagram}` : "",
        safeAbout ? `\nAbout:\n${safeAbout}` : "",
      ].filter((l) => l !== undefined);

      const htmlLines = [
        `<h2 style="font-family:sans-serif">Ambassador Application — Moi</h2>`,
        `<table style="font-family:sans-serif;border-collapse:collapse">`,
        `<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0"><strong>${safeName}</strong></td></tr>`,
        `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>`,
        safePhone
          ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Phone</td><td style="padding:4px 0">${safePhone}</td></tr>`
          : "",
        safeFacebook
          ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Facebook</td><td style="padding:4px 0"><a href="${safeFacebook}">${safeFacebook}</a></td></tr>`
          : "",
        safeInstagram
          ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Instagram</td><td style="padding:4px 0"><a href="${safeInstagram}">${safeInstagram}</a></td></tr>`
          : "",
        `</table>`,
        safeAbout
          ? `<h3 style="font-family:sans-serif;margin-top:20px">About</h3><p style="font-family:sans-serif;white-space:pre-wrap">${safeAbout}</p>`
          : "",
      ].filter(Boolean);

      await transporter.sendMail({
        from: `"Moi Ambassadors" <${SMTP_USER}>`,
        to: emailTo,
        replyTo: safeEmail,
        subject: `Ambassador Application — ${safeName}`,
        text: textLines.join("\n"),
        html: htmlLines.join(""),
      });

      req.log.info({ to: emailTo }, "Ambassador email sent");
    } catch (err) {
      req.log.error({ err }, "Failed to send ambassador email");
      res.status(500).json({ error: "Failed to send your application. Please try again." });
      return;
    }
  } else {
    req.log.warn(
      { name: safeName, email: safeEmail },
      "SMTP not configured — ambassador application logged only",
    );
  }

  res.status(200).json({ success: true });
});

export default router;

import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface NewsletterBody {
  email?: unknown;
}

router.post("/newsletter", (req, res) => {
  const { email } = req.body as NewsletterBody;

  if (typeof email !== "string" || !email.includes("@") || email.trim().length === 0) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  req.log.info({ email: email.trim() }, "Newsletter subscription request");

  res.status(200).json({ success: true });
});

export default router;

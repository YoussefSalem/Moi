import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
}

router.post("/contact", (req, res) => {
  const { name, email, message } = req.body as ContactBody;

  if (
    typeof name !== "string" || name.trim().length === 0 ||
    typeof email !== "string" || !email.includes("@") ||
    typeof message !== "string" || message.trim().length === 0
  ) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  req.log.info(
    { name: name.trim(), email: email.trim(), messageLength: message.trim().length },
    "Contact form submission",
  );

  res.status(200).json({ success: true });
});

export default router;

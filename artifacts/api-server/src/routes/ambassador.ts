import { Router, type IRouter } from "express";
import { db, ambassadorApplications } from "@workspace/db";

const router: IRouter = Router();

interface AmbassadorBody {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  facebook?: unknown;
  instagram?: unknown;
  message?: unknown;
}

router.post("/ambassador", async (req, res) => {
  const { name, phone, email, facebook, instagram, message } =
    req.body as AmbassadorBody;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof message !== "string" ||
    message.trim().length === 0
  ) {
    res.status(400).json({ error: "Name, email and message are required." });
    return;
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safePhone = typeof phone === "string" ? phone.trim() : "";
  const safeFacebook = typeof facebook === "string" ? facebook.trim() : "";
  const safeInstagram = typeof instagram === "string" ? instagram.trim() : "";
  const safeMessage = message.trim();

  req.log.info(
    { name: safeName, email: safeEmail },
    "Ambassador application received",
  );

  try {
    const [application] = await db
      .insert(ambassadorApplications)
      .values({
        name: safeName,
        email: safeEmail,
        phone: safePhone,
        facebook: safeFacebook,
        instagram: safeInstagram,
        message: safeMessage,
      })
      .returning();

    req.log.info(
      { id: application.id, name: safeName },
      "Ambassador application saved to database",
    );

    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save ambassador application");
    res.status(500).json({ error: "Could not save your application. Please try again." });
  }
});

router.get("/ambassador/applications", async (req, res) => {
  try {
    const applications = await db
      .select()
      .from(ambassadorApplications)
      .orderBy(ambassadorApplications.createdAt);

    res.status(200).json({ applications });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch ambassador applications");
    res.status(500).json({ error: "Could not fetch applications." });
  }
});

export default router;

import { Resend } from "resend";
import { buildCODOrderEmail } from "./src/lib/email.ts";

const lineItems = [{
  title: "MOI WAVVY",
  variant_title: "Light Blue / One Size",
  quantity: 1,
  price: "899.00",
}];

const { html, text } = buildCODOrderEmail({
  orderNumber: "TEST-1245",
  customerName: "Nourhan",
  total: "859.10",
  address: "272 treat elgabal",
  governorate: "Cairo",
  city: "Cairo",
  lineItems,
  discountAmount: "89.90",
  discountCode: "MOI10",
  shippingAmount: "50.00",
});

const apiKey = process.env.RESEND_CHECKOUT_KEY ?? process.env.RESEND_API_KEY;
const fromRaw = (process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev").trim();
const from = fromRaw.includes("<") ? fromRaw : `Moi <${fromRaw}>`;

const resend = new Resend(apiKey);
const { error, data } = await resend.emails.send({
  from,
  to: "youssefasalem@gmail.com",
  subject: "[TEST] Your Moi order #TEST-1245 has been placed",
  html,
  text,
});

if (error) {
  console.error("Failed:", error);
  process.exit(1);
} else {
  console.log("Sent! ID:", data?.id);
}

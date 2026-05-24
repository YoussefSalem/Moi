import { sendEmail, buildInstapayConfirmedEmail, buildInstapayRejectedEmail } from "../artifacts/api-server/src/lib/email";

const confirmed = buildInstapayConfirmedEmail({
  orderNumber: 1234,
  customerName: "Sarah",
  total: "949.00",
  referenceNumber: "INSTAPAY-REF-789",
  address: "14 El-Nasr Street, Maadi",
  city: "Cairo",
  governorate: "Cairo",
  shippingAmount: "50.00",
});

const rejected = buildInstapayRejectedEmail({
  draftOrderId: 949,
  customerName: "Sarah",
  total: "949.00",
  referenceNumber: "INSTAPAY-REF-789",
  rejectionReason: "Screenshot unclear",
});

const testEmail = "youssefasalem@gmail.com";

await sendEmail({
  to: testEmail,
  subject: "[TEST] Payment Confirmed \u2014 Moi Order #1234",
  html: confirmed.html,
  text: confirmed.text,
});
console.log("1. Confirmed email sent to", testEmail);

await sendEmail({
  to: testEmail,
  subject: "[TEST] Payment Not Confirmed \u2014 Draft Order #949",
  html: rejected.html,
  text: rejected.text,
});
console.log("2. Rejected email sent to", testEmail);

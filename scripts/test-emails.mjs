import { sendEmail, buildInstapayConfirmedEmail, buildInstapayRejectedEmail } from "../artifacts/api-server/src/lib/email.ts";

// Test InstaPay Confirmed Email
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

// Test InstaPay Rejected Email
const rejected = buildInstapayRejectedEmail({
  draftOrderId: 949,
  customerName: "Sarah",
  total: "949.00",
  referenceNumber: "INSTAPAY-REF-789",
  rejectionReason: "Screenshot unclear",
});

const testEmail = "youssefasalem@gmail.com";

// Send confirmed
await sendEmail({
  to: testEmail,
  subject: "[TEST] Payment Confirmed — Moi Order #1234",
  html: confirmed.html,
  text: confirmed.text,
});
console.log("Confirmed email sent to", testEmail);

// Send rejected
await sendEmail({
  to: testEmail,
  subject: "[TEST] Payment Not Confirmed — Draft Order #949",
  html: rejected.html,
  text: rejected.text,
});
console.log("Rejected email sent to", testEmail);

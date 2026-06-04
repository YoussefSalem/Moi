import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * GET /api/paymob-return
 *
 * Paymob redirects the browser here after payment (used when 3DS navigates
 * the full page away from our site). This page:
 *   1. Writes the result to sessionStorage so the checkout page picks it up on load.
 *   2. Attempts postMessage to the parent/opener (inline-iframe case).
 *   3. If no parent/opener, redirects back to "/" so the checkout page reads
 *      sessionStorage on mount.
 */
router.get("/paymob-return", (req, res) => {
  const success = req.query["success"] === "true";
  const errorOccured = req.query["error_occured"] === "true";
  const merchantOrderId = String(req.query["merchant_order_id"] ?? "");
  const transactionId = String(req.query["id"] ?? "");

  const isSuccess = success && !errorOccured;

  const resultJson = JSON.stringify({
    success: isSuccess,
    merchantOrderId,
    transactionId,
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Processing…</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #efe6da;
      font-family: 'Montserrat', sans-serif;
    }
    p { font-size: 13px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(30,24,20,0.65); }
  </style>
</head>
<body>
  <p>Processing…</p>
  <script>
    (function () {
      var payload = ${resultJson};

      // 1. Write to sessionStorage for full-page redirect recovery
      try { sessionStorage.setItem("moi_paymob_result", JSON.stringify(payload)); } catch (_) {}

      // 2. Try postMessage to parent / opener (inline-iframe case)
      var msg = { type: "PAYMOB_RESULT", success: payload.success, merchantOrderId: payload.merchantOrderId, transactionId: payload.transactionId };
      var sent = false;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, "*"); sent = true;
        } else if (window.opener) {
          window.opener.postMessage(msg, "*"); sent = true;
        }
      } catch (_) {}

      // 3. No parent/opener — redirect to root so checkout page reads sessionStorage
      if (!sent) window.location.replace("/");
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;

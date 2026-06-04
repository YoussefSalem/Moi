import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * GET /api/paymob-return
 *
 * Paymob navigates the embedded iframe (or the browser tab for 3DS redirect)
 * to this URL after payment completes. We return a tiny HTML page that:
 *  1. Stores the result in sessionStorage (works for same-origin iframe and
 *     for full-page redirects alike).
 *  2. Attempts a postMessage to the parent frame (handles the inline-iframe case
 *     where the checkout page is the opener).
 *  3. If neither parent nor opener exists, redirects the top-level window back
 *     to the site root so the checkout page can read from sessionStorage on mount.
 */
router.get("/paymob-return", (req, res) => {
  const success = req.query["success"] === "true";
  const errorOccured = req.query["error_occured"] === "true";
  const merchantOrderId = String(req.query["merchant_order_id"] ?? "");
  const transactionId = String(req.query["id"] ?? "");

  const isSuccess = success && !errorOccured;

  // Serialise the result for sessionStorage — safe subset of query params only
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
    p {
      font-size: 13px; letter-spacing: 0.25em; text-transform: uppercase;
      color: rgba(30,24,20,0.65);
    }
  </style>
</head>
<body>
  <p>Processing…</p>
  <script>
    (function () {
      var STORAGE_KEY = "moi_paymob_result";
      var payload = ${resultJson};

      // 1. Write to sessionStorage so the checkout page can pick it up on load
      //    (works for full-page redirects and same-origin iframes)
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}

      // 2. Try postMessage to the parent / opener (inline-iframe case)
      var msg = { type: "PAYMOB_RESULT", success: payload.success, merchantOrderId: payload.merchantOrderId, transactionId: payload.transactionId };
      var sent = false;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, "*");
          sent = true;
        } else if (window.opener) {
          window.opener.postMessage(msg, "*");
          sent = true;
        }
      } catch (_) {}

      // 3. If no parent/opener (full-page redirect flow), navigate back to the root
      //    so the checkout page reads sessionStorage on mount.
      if (!sent) {
        window.location.replace("/");
      }
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;

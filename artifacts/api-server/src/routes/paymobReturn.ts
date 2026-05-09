import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * GET /api/paymob-return
 *
 * Paymob navigates the embedded iframe to this URL after payment completes.
 * We return a tiny HTML page that reads the result query params and posts a
 * message to the parent window (the checkout page) so no full-page navigation
 * occurs for the customer.
 */
router.get("/paymob-return", (req, res) => {
  const success = req.query["success"] === "true";
  const errorOccured = req.query["error_occured"] === "true";
  const merchantOrderId = String(req.query["merchant_order_id"] ?? "");
  const transactionId = String(req.query["id"] ?? "");

  const isSuccess = success && !errorOccured;

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
      var payload = {
        type: "PAYMOB_RESULT",
        success: ${isSuccess},
        merchantOrderId: ${JSON.stringify(merchantOrderId)},
        transactionId: ${JSON.stringify(transactionId)},
      };
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, "*");
        } else {
          window.top.postMessage(payload, "*");
        }
      } catch (e) {
        // cross-origin guard — should not happen since same origin
      }
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;

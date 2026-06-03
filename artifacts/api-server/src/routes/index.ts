import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import newsletterRouter from "./newsletter";
import ambassadorRouter from "./ambassador";
import restockRouter from "./restock";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";
import paymobWebhookRouter from "./paymobWebhook";
// import paymobInitRouter from "./paymobInit"; // disabled — card payments off
import paymobReturnRouter from "./paymobReturn";
import paymobStatusRouter from "./paymobStatus";
import paymobSyncRouter from "./paymobSync";
import instapayProofRouter from "./instapayProof";
import adminRouter from "./admin";
import customerAuthRouter from "./customerAuth";
import whatsappRouter from "./whatsapp";
import bostaRouter from "./bosta";
import analyticsProxyRouter from "./analyticsProxy";
import analyticsRouter from "./analytics";
import checkoutsRouter from "./checkouts";
import abandonedCartsRouter from "./abandonedCarts";
import metaCapiRouter from "./metaCapi";
// import paymobApplePayInitRouter from "./paymobApplePayInit"; // disabled — Apple Pay off
// import applePayDirectRouter from "./applePayDirect"; // disabled — Apple Pay off
// import shopifyApplePayRouter from "./shopifyApplePay"; // disabled — Apple Pay off
// import shopifyApplePayCheckoutRouter from "./shopifyApplePayCheckout"; // disabled — Apple Pay off

const router: IRouter = Router();

// router.use(shopifyApplePayRouter); // disabled — Apple Pay off
// router.use(shopifyApplePayCheckoutRouter); // disabled — Apple Pay off
router.use(healthRouter);
router.use(contactRouter);
router.use(newsletterRouter);
router.use(ambassadorRouter);
router.use(restockRouter);
router.use(ordersRouter);
// router.use(paymobInitRouter); // disabled — card payments off
router.use(paymobReturnRouter);
router.use(paymobStatusRouter);
router.use(paymobSyncRouter);
router.use(instapayProofRouter);
router.use(adminRouter);
router.use(customerAuthRouter);
router.use(webhooksRouter);
router.use(paymobWebhookRouter);
router.use(whatsappRouter);
router.use(bostaRouter);
router.use(analyticsProxyRouter);
router.use(analyticsRouter);
router.use(checkoutsRouter);
router.use(abandonedCartsRouter);
router.use(metaCapiRouter);
// router.use(paymobApplePayInitRouter); // disabled — Apple Pay off
// router.use(applePayDirectRouter); // disabled — Apple Pay off

export default router;

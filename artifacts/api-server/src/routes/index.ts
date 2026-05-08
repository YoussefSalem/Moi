import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import newsletterRouter from "./newsletter";
import ambassadorRouter from "./ambassador";
import restockRouter from "./restock";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(newsletterRouter);
router.use(ambassadorRouter);
router.use(restockRouter);
router.use(ordersRouter);
router.use(webhooksRouter);

export default router;

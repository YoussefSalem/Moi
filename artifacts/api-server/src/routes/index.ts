import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import newsletterRouter from "./newsletter";
import ambassadorRouter from "./ambassador";
import restockRouter from "./restock";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(newsletterRouter);
router.use(ambassadorRouter);
router.use(restockRouter);

export default router;

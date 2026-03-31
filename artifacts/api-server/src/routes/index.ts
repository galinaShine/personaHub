import { Router, type IRouter } from "express";
import healthRouter from "./health";
import personasRouter from "./personas/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/personas", personasRouter);

export default router;

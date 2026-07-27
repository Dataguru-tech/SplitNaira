import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getLedgerBlocks } from "../services/ledger.service.js";

export const ledgerRouter = Router();

const ledgerBlocksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

ledgerRouter.get("/blocks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, cursor } = ledgerBlocksQuerySchema.parse(req.query);
    const result = await getLedgerBlocks({ limit, cursor });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ledgerRouter } from "../routes/ledger.js";
import { errorHandler, notFoundHandler } from "../middleware/error.js";
import { requestIdMiddleware } from "../middleware/request-id.js";

const { getLedgerBlocksMock } = vi.hoisted(() => ({
  getLedgerBlocksMock: vi.fn(),
}));

vi.mock("../services/ledger.service.js", () => ({
  getLedgerBlocks: getLedgerBlocksMock,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/api/ledger", ledgerRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("Ledger Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLedgerBlocksMock.mockResolvedValue({ blocks: [], nextCursor: null });
  });

  it("returns paginated ledger blocks", async () => {
    const app = createApp();
    getLedgerBlocksMock.mockResolvedValue({
      blocks: [{ id: "11111111-1111-4111-8111-111111111111", ledgerSeq: 100, txHash: "abc", type: "settlement" }],
      nextCursor: "11111111-1111-4111-8111-111111111111",
    });

    const response = await request(app).get("/api/ledger/blocks?limit=1");

    expect(response.status).toBe(200);
    expect(response.body.blocks).toHaveLength(1);
    expect(response.body.nextCursor).toBe("11111111-1111-4111-8111-111111111111");
    expect(getLedgerBlocksMock).toHaveBeenCalledWith({ limit: 1, cursor: undefined });
  });

  it("rejects invalid cursor", async () => {
    const app = createApp();
    const response = await request(app).get("/api/ledger/blocks?cursor=bad-cursor");

    expect(response.status).toBe(400);
  });
});

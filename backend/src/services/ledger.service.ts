import { getDataSource } from "./database.js";
import { LedgerBlock } from "../entities/LedgerBlock.js";

export interface LedgerBlocksQuery {
  limit: number;
  cursor?: string;
}

export interface LedgerBlocksPage {
  blocks: LedgerBlock[];
  nextCursor: string | null;
}

export async function getLedgerBlocks(query: LedgerBlocksQuery): Promise<LedgerBlocksPage> {
  const repo = getDataSource().getRepository(LedgerBlock);
  const qb = repo.createQueryBuilder("block").orderBy("block.ledgerSeq", "DESC").addOrderBy("block.id", "DESC");

  if (query.cursor) {
    qb.andWhere("block.id < :cursor", { cursor: query.cursor });
  }

  qb.take(query.limit);
  const blocks = await qb.getMany();
  const nextCursor = blocks.length === query.limit ? blocks[blocks.length - 1]?.id ?? null : null;
  return { blocks, nextCursor };
}

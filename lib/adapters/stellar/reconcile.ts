import { isListable, type ItemId, type ItemRegistry, type TokenId } from '@/lib/registry';
import { PortError } from '@/lib/adapters/helpers';
import { tokenIdToU32 } from './ids';
import { u32ScVal, viewOrThrow } from './sc';

export interface ChainNftViews {
  exists: (tokenId: TokenId) => Promise<boolean>;
  itemIdOnChain: (tokenId: TokenId) => Promise<string>;
}

export interface ReconcileStellarAsNftResult {
  revertedIds: ItemId[];
}

function viewsForContract(nftContractId: string): ChainNftViews {
  return {
    async exists(tokenId) {
      const raw = await viewOrThrow(nftContractId, 'exists', [
        u32ScVal(tokenIdToU32(tokenId)),
      ]);
      return Boolean(raw);
    },
    async itemIdOnChain(tokenId) {
      const raw = await viewOrThrow(nftContractId, 'get_item_id', [
        u32ScVal(tokenIdToU32(tokenId)),
      ]);
      return String(raw ?? '');
    },
  };
}

/**
 * Revert leftover AsNft rows from old item-nft deploys / colliding token ids.
 * Uses markInGame (v2) — item returns to inventory so the player can re-export.
 *
 * Revert when:
 * - tokenId is not a decimal u32 (mock leftover on stellar)
 * - `exists(tokenId)` is false (e.g. owner_of #6 / token 2 after NextId reset)
 * - on-chain `get_item_id` is a different Registry item (two bows sharing "0")
 */
export async function reconcileStellarAsNft(params: {
  registry: ItemRegistry;
  ownerId: string;
  nftContractId?: string;
  views?: ChainNftViews;
}): Promise<ReconcileStellarAsNftResult> {
  const views =
    params.views ??
    (params.nftContractId
      ? viewsForContract(params.nftContractId)
      : null);
  if (!views) {
    throw new PortError('reconcileStellarAsNft requires nftContractId or views');
  }
  if (!params.ownerId) return { revertedIds: [] };

  const revertedIds: ItemId[] = [];
  const rows = params.registry
    .listByOwner(params.ownerId)
    .filter(isListable);

  for (const item of rows) {
    const tokenId = item.tokenId!;
    const shouldRevert = await staleExport(tokenId, item.id, views);
    if (!shouldRevert) continue;
    try {
      params.registry.markInGame(item.id);
      revertedIds.push(item.id);
    } catch {
      /* already flipped or not AsNft */
    }
  }

  return { revertedIds };
}

async function staleExport(
  tokenId: TokenId,
  itemId: ItemId,
  views: ChainNftViews
): Promise<boolean> {
  if (!/^\d+$/.test(tokenId)) return true;
  try {
    const exists = await views.exists(tokenId);
    if (!exists) return true;
    const chainItemId = await views.itemIdOnChain(tokenId);
    if (chainItemId && chainItemId !== itemId) return true;
    return false;
  } catch {
    return false;
  }
}

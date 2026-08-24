import { isListable, type Item, type ItemRegistry, type TokenId } from '@/lib/registry';
import { PortError, findItemByTokenId } from '@/lib/adapters/helpers';
import { tokenIdToU32 } from './ids';
import { assertStellarAddress, u32ScVal, viewOrThrow } from './sc';

/**
 * Listable gate (Registry) + on-chain owner check.
 * After stellar export remap, seller === Registry owner === chain owner.
 */
export async function requireListableChainOwner(
  registry: ItemRegistry,
  nftContractId: string,
  tokenId: TokenId,
  seller: string
): Promise<Item> {
  assertStellarAddress(seller, 'seller');
  const item = findItemByTokenId(registry, tokenId);
  if (!item) {
    throw new PortError(`No item found for tokenId ${tokenId}`);
  }
  if (!isListable(item)) {
    throw new PortError(
      `Item is not listable (state=${item.state}, tokenId=${item.tokenId ?? 'none'})`
    );
  }

  const onChainOwner = await viewOrThrow(nftContractId, 'owner_of', [
    u32ScVal(tokenIdToU32(tokenId)),
  ]);
  if (String(onChainOwner) !== seller) {
    throw new PortError('Connected wallet is not the on-chain NFT owner');
  }
  if (item.ownerId !== seller) {
    throw new PortError('Registry owner does not match seller');
  }
  return item;
}

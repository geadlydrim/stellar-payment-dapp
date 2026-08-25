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
  const item = findItemByTokenId(registry, tokenId, seller);
  if (!item) {
    throw new PortError("Couldn't find that NFT in your inventory.");
  }
  if (!isListable(item)) {
    throw new PortError('Export this item from Play before listing it.');
  }

  const onChainId = tokenIdToU32(tokenId);
  const exists = await viewOrThrow(nftContractId, 'exists', [
    u32ScVal(onChainId),
  ]);
  if (!exists) {
    throw new PortError(
      'This NFT is not on the current network. Refresh the page, then export it again from Play.'
    );
  }
  const chainItemId = String(
    (await viewOrThrow(nftContractId, 'get_item_id', [u32ScVal(onChainId)])) ??
      ''
  );
  if (chainItemId && chainItemId !== item.id) {
    throw new PortError(
      "This inventory item doesn't match the on-chain NFT. Refresh the page."
    );
  }

  const onChainOwner = await viewOrThrow(nftContractId, 'owner_of', [
    u32ScVal(onChainId),
  ]);
  if (String(onChainOwner) !== seller) {
    throw new PortError("This wallet doesn't own that NFT.");
  }
  if (item.ownerId !== seller) {
    throw new PortError("This NFT isn't in your inventory.");
  }
  return item;
}

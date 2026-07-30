import type { Item } from './types';

/** Usable in combat/inventory actions only if InGame. */
export function isUsable(item: Item): boolean {
  return item.state === 'InGame';
}

/** Marketplace-listable only if AsNft with a tokenId. */
export function isListable(item: Item): boolean {
  return item.state === 'AsNft' && !!item.tokenId;
}

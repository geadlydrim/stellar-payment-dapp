import type { ItemId, TokenId } from '@/lib/registry';

/**
 * Export / import bridge between Registry item state and NFT token ids.
 * Mock invents tokenIds; Stellar adapter will call item-nft mint/burn.
 */
export interface NftBridge {
  /**
   * Export: lock (if needed) → mint/represent as NFT → markAsNft.
   * Mock: invent a fake tokenId and flip state.
   * Stellar: call item-nft contract mint.
   */
  exportToNft(
    itemId: ItemId,
    ownerId: string
  ): Promise<{ tokenId: TokenId }>;

  /**
   * Import: burn/redeem NFT → markInGame.
   * Mock: flip state only.
   */
  importFromNft(
    tokenId: TokenId,
    ownerId: string
  ): Promise<{ itemId: ItemId }>;
}

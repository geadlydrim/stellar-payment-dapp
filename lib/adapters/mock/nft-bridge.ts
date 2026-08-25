import type { ItemId, ItemRegistry, TokenId } from '@/lib/registry';
import type { NftBridge } from '@/lib/ports';
import { PortError, findItemByTokenId } from './helpers';

export type ListedTokenChecker = (tokenId: TokenId) => boolean;

export interface MockNftBridgeOptions {
  registry: ItemRegistry;
  /** Return true if token is on an active marketplace listing (blocks import). */
  isTokenListed?: ListedTokenChecker;
  idFactory?: () => TokenId;
}

function defaultTokenId(itemId: ItemId): TokenId {
  return `mock-nft-${itemId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}-${Date.now().toString(36)}`;
}

/**
 * Mock NftBridge: invents tokenIds and drives Registry lock → AsNft / AsNft → InGame.
 * Swap for StellarNftBridge that calls item-nft mint/burn, then the same Registry flips.
 */
export class MockNftBridge implements NftBridge {
  private readonly registry: ItemRegistry;
  private readonly isTokenListed: ListedTokenChecker;
  private readonly idFactory: (itemId: ItemId) => TokenId;

  constructor(options: MockNftBridgeOptions) {
    this.registry = options.registry;
    this.isTokenListed = options.isTokenListed ?? (() => false);
    this.idFactory = options.idFactory
      ? () => options.idFactory!()
      : defaultTokenId;
  }

  async exportToNft(
    itemId: ItemId,
    ownerId: string
  ): Promise<{ tokenId: TokenId }> {
    const item = this.registry.get(itemId);
    if (!item) throw new PortError('Item not found.');
    if (item.ownerId !== ownerId) {
      throw new PortError("That's not your item.");
    }

    if (item.state === 'AsNft' && item.tokenId) {
      return { tokenId: item.tokenId };
    }

    if (item.state === 'InGame') {
      this.registry.lockForTrade(itemId, ownerId);
    } else if (item.state !== 'LockedForTrade') {
      throw new PortError("This item isn't ready to export.");
    }

    const tokenId = this.idFactory(itemId);
    this.registry.markAsNft(itemId, tokenId);
    return { tokenId };
  }

  async importFromNft(
    tokenId: TokenId,
    ownerId: string
  ): Promise<{ itemId: ItemId }> {
    if (!tokenId) throw new PortError('Pick an NFT first.');
    if (this.isTokenListed(tokenId)) {
      throw new PortError(
        'Cancel the marketplace listing before bringing this NFT back to Play.'
      );
    }

    const item = findItemByTokenId(this.registry, tokenId, ownerId);
    if (!item) throw new PortError("Couldn't find that NFT in your inventory.");
    if (item.ownerId !== ownerId) {
      throw new PortError("That's not your NFT.");
    }
    if (item.state !== 'AsNft') {
      throw new PortError("This item isn't an NFT you can bring back to Play right now.");
    }

    this.registry.markInGame(item.id);
    return { itemId: item.id };
  }
}

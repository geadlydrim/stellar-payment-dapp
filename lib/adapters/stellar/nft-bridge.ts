import type { ItemId, ItemRegistry, TokenId } from '@/lib/registry';
import type { NftBridge } from '@/lib/ports';
import {
  PortError,
  findItemByTokenId,
  transferItemOwner,
} from '@/lib/adapters/helpers';
import { getAddress } from '@/lib/wallet';
import type { StellarContractIds } from './env';
import { tokenIdToU32, u32ToTokenId } from './ids';
import {
  addressScVal,
  assertStellarAddress,
  invokeOrThrow,
  stringScVal,
  u32ScVal,
  viewOrThrow,
} from './sc';
import {
  assertNotGuestExportOwner,
  assertStellarExportOwner,
} from './export-owner';

export type ListedTokenChecker = (tokenId: TokenId) => boolean | Promise<boolean>;

export interface StellarNftBridgeOptions {
  registry: ItemRegistry;
  contracts: StellarContractIds;
  /** True if token is escrowed on any market listing (blocks import). */
  isTokenListed?: ListedTokenChecker;
  /**
   * Resolve the wallet that signs mint/burn.
   * Defaults to connected Freighter address via lib/wallet.
   */
  resolveSigner?: () => Promise<string>;
  /**
   * On-chain mint. Defaults to item-nft `mint(minter, to, item_id)`.
   * Tests may stub this to avoid a live chain.
   */
  mintToken?: (itemId: ItemId, signer: string) => Promise<TokenId>;
}

/**
 * NftBridge → item-nft mint/burn, then Registry markAsNft / markInGame.
 * On-chain token id is u32; TokenId at the port boundary is its decimal string.
 */
export class StellarNftBridge implements NftBridge {
  private readonly registry: ItemRegistry;
  private readonly contracts: StellarContractIds;
  private readonly isTokenListed: ListedTokenChecker;
  private readonly resolveSigner: () => Promise<string>;
  private readonly mintToken: (itemId: ItemId, signer: string) => Promise<TokenId>;

  constructor(options: StellarNftBridgeOptions) {
    this.registry = options.registry;
    this.contracts = options.contracts;
    this.isTokenListed = options.isTokenListed ?? (() => false);
    this.resolveSigner =
      options.resolveSigner ??
      (async () => {
        const addr = await getAddress();
        if (!addr) {
          throw new PortError('Connect a wallet before exporting / importing NFTs');
        }
        return addr;
      });
    this.mintToken =
      options.mintToken ??
      (async (itemId, signer) => {
        const result = await invokeOrThrow(
          this.contracts.itemNft,
          'mint',
          [addressScVal(signer), addressScVal(signer), stringScVal(itemId)],
          signer
        );
        const rawId = result.returnValue;
        if (rawId === undefined || rawId === null) {
          throw new PortError('mint succeeded but returned no token_id');
        }
        return u32ToTokenId(rawId as number | bigint | string);
      });
  }

  async exportToNft(
    itemId: ItemId,
    ownerId: string
  ): Promise<{ tokenId: TokenId }> {
    const item = this.registry.get(itemId);
    if (!item) throw new PortError(`Item not found: ${itemId}`);

    // Reject guest before wallet prompt / lock — stellar must not mint the demo bag.
    assertNotGuestExportOwner(ownerId);

    if (item.ownerId !== ownerId) {
      throw new PortError('Not your item');
    }

    if (item.state === 'AsNft' && item.tokenId) {
      return { tokenId: item.tokenId };
    }

    const signer = await this.resolveSigner();
    assertStellarExportOwner(ownerId, signer);

    if (item.state === 'InGame') {
      this.registry.lockForTrade(itemId, ownerId);
    } else if (item.state !== 'LockedForTrade') {
      throw new PortError(`Cannot export item in state ${item.state}`);
    }

    const tokenId = await this.mintToken(itemId, signer);

    this.registry.markAsNft(itemId, tokenId);
    // v2: no transferOwnership — align Registry owner with chain `to` / signer.
    transferItemOwner(this.registry, itemId, signer);

    return { tokenId };
  }

  async importFromNft(
    tokenId: TokenId,
    ownerId: string
  ): Promise<{ itemId: ItemId }> {
    if (!tokenId) throw new PortError('tokenId is required');
    if (await this.isTokenListed(tokenId)) {
      throw new PortError(
        'NFT is listed on the marketplace — cancel the listing before importing'
      );
    }

    const item = findItemByTokenId(this.registry, tokenId);
    if (!item) throw new PortError(`No item found for tokenId ${tokenId}`);
    if (item.ownerId !== ownerId) {
      throw new PortError('Not your NFT');
    }
    if (item.state !== 'AsNft') {
      throw new PortError(`Cannot import: item is ${item.state}`);
    }

    const signer = await this.resolveSigner();
    assertStellarAddress(signer, 'wallet');

    // Session ownerId already matched Registry owner above; chain owner must be signer.
    const onChainOwner = await this.ownerOf(tokenId);
    if (onChainOwner !== signer) {
      throw new PortError('Connected wallet is not the on-chain NFT owner');
    }

    const onChainId = tokenIdToU32(tokenId);
    await invokeOrThrow(
      this.contracts.itemNft,
      'burn',
      [addressScVal(signer), u32ScVal(onChainId)],
      signer
    );

    this.registry.markInGame(item.id);
    return { itemId: item.id };
  }

  /** Optional view helper for debugging. */
  async ownerOf(tokenId: TokenId): Promise<string> {
    const raw = await viewOrThrow(this.contracts.itemNft, 'owner_of', [
      u32ScVal(tokenIdToU32(tokenId)),
    ]);
    return String(raw);
  }
}

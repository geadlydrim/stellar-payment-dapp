import type { ItemRegistry, TokenId } from '@/lib/registry';
import type { FixedPriceListing, FixedPricePort } from '@/lib/ports';
import {
  PortError,
  findItemByTokenId,
  parseXlm,
  transferItemOwner,
} from '@/lib/adapters/helpers';
import type { StellarContractIds } from './env';
import { listingIdToU32, tokenIdToU32, u32ToTokenId } from './ids';
import { requireListableChainOwner } from './listable';
import {
  addressScVal,
  assertStellarAddress,
  i128ScVal,
  invokeOrThrow,
  stroopsToXlm,
  u32ScVal,
  viewOrThrow,
  xlmToStroops,
} from './sc';

export interface StellarFixedPricePortOptions {
  registry: ItemRegistry;
  contracts: StellarContractIds;
  isTokenBusyElsewhere: (tokenId: TokenId) => boolean | Promise<boolean>;
}

export class StellarFixedPricePort implements FixedPricePort {
  private readonly registry: ItemRegistry;
  private readonly contracts: StellarContractIds;
  private readonly isTokenBusyElsewhere: (
    tokenId: TokenId
  ) => boolean | Promise<boolean>;

  constructor(options: StellarFixedPricePortOptions) {
    this.registry = options.registry;
    this.contracts = options.contracts;
    this.isTokenBusyElsewhere = options.isTokenBusyElsewhere;
  }

  async list(params: {
    tokenId: TokenId;
    seller: string;
    priceXlm: string;
  }): Promise<FixedPriceListing> {
    await requireListableChainOwner(
      this.registry,
      this.contracts.itemNft,
      params.tokenId,
      params.seller
    );
    parseXlm(params.priceXlm);
    if (Number(params.priceXlm) <= 0) {
      throw new PortError('Enter a price greater than 0.');
    }
    if (
      (await this.isActiveHere(params.tokenId)) ||
      (await this.isTokenBusyElsewhere(params.tokenId))
    ) {
      throw new PortError('This NFT is already listed.');
    }

    const result = await invokeOrThrow(
      this.contracts.fixedPrice,
      'list',
      [
        addressScVal(params.seller),
        u32ScVal(tokenIdToU32(params.tokenId)),
        i128ScVal(xlmToStroops(params.priceXlm)),
      ],
      params.seller
    );

    const listingId =
      result.returnValue !== undefined && result.returnValue !== null
        ? Number(result.returnValue as number | bigint)
        : undefined;
    if (listingId === undefined || !Number.isInteger(listingId)) {
      throw new PortError("Couldn't create the listing. Try again.");
    }

    return {
      listingId,
      tokenId: params.tokenId,
      seller: params.seller,
      priceXlm: params.priceXlm,
      active: true,
    };
  }

  async buy(params: {
    listingId: string | number;
    buyer: string;
  }): Promise<{ listingId: string | number; tokenId: TokenId }> {
    assertStellarAddress(params.buyer, 'buyer');
    const id = listingIdToU32(params.listingId);

    const before = await this.getListingRaw(id);
    if (!before.active) throw new PortError('This listing is no longer for sale.');
    if (String(before.seller) === params.buyer) {
      throw new PortError("You can't buy your own listing.");
    }

    const tokenId = u32ToTokenId(before.token_id as number | bigint);
    const item = findItemByTokenId(this.registry, tokenId, String(before.seller));
    if (!item) throw new PortError("That listing's item is missing. Refresh and try again.");

    await invokeOrThrow(
      this.contracts.fixedPrice,
      'buy',
      [u32ScVal(id), addressScVal(params.buyer)],
      params.buyer
    );

    // CONTRACTS v2: sync Registry owner after on-chain settle
    transferItemOwner(this.registry, item.id, params.buyer);

    return { listingId: id, tokenId };
  }

  async cancel(params: {
    listingId: string | number;
    seller: string;
  }): Promise<void> {
    assertStellarAddress(params.seller, 'seller');
    const id = listingIdToU32(params.listingId);
    await invokeOrThrow(
      this.contracts.fixedPrice,
      'cancel',
      [u32ScVal(id), addressScVal(params.seller)],
      params.seller
    );
  }

  async listActive(): Promise<FixedPriceListing[]> {
    const raw = await viewOrThrow(this.contracts.fixedPrice, 'list_active', []);
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => this.mapListing(row as Record<string, unknown>));
  }

  async isTokenListed(tokenId: TokenId): Promise<boolean> {
    return this.isActiveHere(tokenId);
  }

  private async isActiveHere(tokenId: TokenId): Promise<boolean> {
    const active = await this.listActive();
    return active.some((l) => l.tokenId === tokenId && l.active);
  }

  private async getListingRaw(id: number): Promise<Record<string, unknown>> {
    const raw = await viewOrThrow(this.contracts.fixedPrice, 'get_listing', [
      u32ScVal(id),
    ]);
    if (!raw || typeof raw !== 'object') {
      throw new PortError('Sale listing not found.');
    }
    return raw as Record<string, unknown>;
  }

  private mapListing(raw: Record<string, unknown>): FixedPriceListing {
    return {
      listingId: Number(raw.id ?? 0),
      tokenId: u32ToTokenId(raw.token_id as number | bigint),
      seller: String(raw.seller ?? ''),
      priceXlm: stroopsToXlm(raw.price as number | bigint),
      active: Boolean(raw.active),
    };
  }
}

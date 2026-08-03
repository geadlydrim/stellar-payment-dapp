import type { ItemRegistry, TokenId } from '@/lib/registry';
import type { FixedPriceListing, FixedPricePort } from '@/lib/ports';
import {
  PortError,
  findItemByTokenId,
  nextId,
  parseXlm,
  requireListableOwned,
  transferItemOwner,
} from './helpers';

export interface MockFixedPriceStore {
  listings: FixedPriceListing[];
}

export interface MockFixedPricePortOptions {
  registry: ItemRegistry;
  store: MockFixedPriceStore;
  persist: () => void;
  /** True if token is listed on auction or offer board. */
  isTokenBusyElsewhere: (tokenId: TokenId) => boolean;
}

export class MockFixedPricePort implements FixedPricePort {
  private readonly registry: ItemRegistry;
  private readonly store: MockFixedPriceStore;
  private readonly persist: () => void;
  private readonly isTokenBusyElsewhere: (tokenId: TokenId) => boolean;

  constructor(options: MockFixedPricePortOptions) {
    this.registry = options.registry;
    this.store = options.store;
    this.persist = options.persist;
    this.isTokenBusyElsewhere = options.isTokenBusyElsewhere;
  }

  async list(params: {
    tokenId: TokenId;
    seller: string;
    priceXlm: string;
  }): Promise<FixedPriceListing> {
    requireListableOwned(this.registry, params.tokenId, params.seller);
    parseXlm(params.priceXlm);
    if (Number(params.priceXlm) <= 0) {
      throw new PortError('priceXlm must be > 0');
    }
    if (this.isActiveHere(params.tokenId) || this.isTokenBusyElsewhere(params.tokenId)) {
      throw new PortError('Token is already listed on the marketplace');
    }

    const listing: FixedPriceListing = {
      listingId: nextId('sale'),
      tokenId: params.tokenId,
      seller: params.seller,
      priceXlm: params.priceXlm,
      active: true,
    };
    this.store.listings.push(listing);
    this.persist();
    return { ...listing };
  }

  async buy(params: {
    listingId: string | number;
    buyer: string;
  }): Promise<{ listingId: string | number; tokenId: TokenId }> {
    const listing = this.requireListing(params.listingId);
    if (!listing.active) throw new PortError('Listing is not active');
    if (listing.seller === params.buyer) {
      throw new PortError('Cannot buy your own listing');
    }

    const item = findItemByTokenId(this.registry, listing.tokenId);
    if (!item) throw new PortError('Listed item missing from registry');

    listing.active = false;
    transferItemOwner(this.registry, item.id, params.buyer);
    this.persist();
    return { listingId: listing.listingId, tokenId: listing.tokenId };
  }

  async cancel(params: {
    listingId: string | number;
    seller: string;
  }): Promise<void> {
    const listing = this.requireListing(params.listingId);
    if (!listing.active) throw new PortError('Listing is not active');
    if (listing.seller !== params.seller) {
      throw new PortError('Only the seller can cancel');
    }
    listing.active = false;
    this.persist();
  }

  async listActive(): Promise<FixedPriceListing[]> {
    return this.store.listings.filter((l) => l.active).map((l) => ({ ...l }));
  }

  isTokenListed(tokenId: TokenId): boolean {
    return this.isActiveHere(tokenId);
  }

  private isActiveHere(tokenId: TokenId): boolean {
    return this.store.listings.some((l) => l.active && l.tokenId === tokenId);
  }

  private requireListing(listingId: string | number): FixedPriceListing {
    const listing = this.store.listings.find(
      (l) => String(l.listingId) === String(listingId)
    );
    if (!listing) throw new PortError(`Sale listing not found: ${listingId}`);
    return listing;
  }
}

import type { ItemRegistry, TokenId } from '@/lib/registry';
import type { OfferBoardPort, TradeListing, TradeOffer } from '@/lib/ports';
import {
  PortError,
  findItemByTokenId,
  nextId,
  parseXlm,
  requireListableOwned,
  transferItemOwner,
} from './helpers';

export interface MockOfferBoardStore {
  listings: TradeListing[];
  offers: TradeOffer[];
}

export interface MockOfferBoardPortOptions {
  registry: ItemRegistry;
  store: MockOfferBoardStore;
  persist: () => void;
  isTokenBusyElsewhere: (tokenId: TokenId) => boolean;
}

/**
 * Offer-board trade: submit / accept / reject (XLM and/or tokenIds).
 * Not a silent swap — accept is explicit.
 */
export class MockOfferBoardPort implements OfferBoardPort {
  private readonly registry: ItemRegistry;
  private readonly store: MockOfferBoardStore;
  private readonly persist: () => void;
  private readonly isTokenBusyElsewhere: (tokenId: TokenId) => boolean;

  constructor(options: MockOfferBoardPortOptions) {
    this.registry = options.registry;
    this.store = options.store;
    this.persist = options.persist;
    this.isTokenBusyElsewhere = options.isTokenBusyElsewhere;
  }

  async listForOffers(params: {
    tokenId: TokenId;
    seller: string;
    wantsHint?: string;
  }): Promise<TradeListing> {
    requireListableOwned(this.registry, params.tokenId, params.seller);
    if (this.isActiveHere(params.tokenId) || this.isTokenBusyElsewhere(params.tokenId)) {
      throw new PortError('Token is already listed on the marketplace');
    }

    const listing: TradeListing = {
      listingId: nextId('trade'),
      tokenId: params.tokenId,
      seller: params.seller,
      wantsHint: params.wantsHint,
      active: true,
    };
    this.store.listings.push(listing);
    this.persist();
    return { ...listing };
  }

  async submitOffer(params: {
    listingId: string | number;
    buyer: string;
    xlm: string;
    offerTokenIds: TokenId[];
  }): Promise<TradeOffer> {
    const listing = this.requireListing(params.listingId);
    if (!listing.active) throw new PortError('Trade listing is not active');
    if (listing.seller === params.buyer) {
      throw new PortError('Cannot offer on your own listing');
    }

    parseXlm(params.xlm);
    const offerTokenIds = params.offerTokenIds ?? [];
    if (Number(params.xlm) <= 0 && offerTokenIds.length === 0) {
      throw new PortError('Offer must include XLM and/or at least one tokenId');
    }

    for (const tid of offerTokenIds) {
      requireListableOwned(this.registry, tid, params.buyer);
      if (tid === listing.tokenId) {
        throw new PortError('Cannot offer the listed token itself');
      }
    }

    const offer: TradeOffer = {
      offerId: nextId('offer'),
      listingId: listing.listingId,
      buyer: params.buyer,
      xlm: params.xlm,
      offerTokenIds: [...offerTokenIds],
      status: 'pending',
    };
    this.store.offers.push(offer);
    this.persist();
    return { ...offer, offerTokenIds: [...offer.offerTokenIds] };
  }

  async acceptOffer(params: {
    offerId: string | number;
    seller: string;
  }): Promise<void> {
    const offer = this.requireOffer(params.offerId);
    if (offer.status !== 'pending') {
      throw new PortError(`Offer is ${offer.status}`);
    }
    const listing = this.requireListing(offer.listingId);
    if (!listing.active) throw new PortError('Trade listing is not active');
    if (listing.seller !== params.seller) {
      throw new PortError('Only the seller can accept');
    }

    const listedItem = findItemByTokenId(this.registry, listing.tokenId);
    if (!listedItem) throw new PortError('Listed item missing');

    // Transfer listed NFT → buyer; offered NFTs → seller (XLM is mock-only)
    transferItemOwner(this.registry, listedItem.id, offer.buyer);
    for (const tid of offer.offerTokenIds) {
      const offered = findItemByTokenId(this.registry, tid);
      if (!offered) throw new PortError(`Offered token missing: ${tid}`);
      transferItemOwner(this.registry, offered.id, listing.seller);
    }

    offer.status = 'accepted';
    listing.active = false;
    for (const o of this.store.offers) {
      if (
        String(o.listingId) === String(listing.listingId) &&
        o.status === 'pending' &&
        String(o.offerId) !== String(offer.offerId)
      ) {
        o.status = 'cancelled';
      }
    }
    this.persist();
  }

  async rejectOffer(params: {
    offerId: string | number;
    seller: string;
  }): Promise<void> {
    const offer = this.requireOffer(params.offerId);
    if (offer.status !== 'pending') {
      throw new PortError(`Offer is ${offer.status}`);
    }
    const listing = this.requireListing(offer.listingId);
    if (listing.seller !== params.seller) {
      throw new PortError('Only the seller can reject');
    }
    offer.status = 'rejected';
    this.persist();
  }

  async cancelListing(params: {
    listingId: string | number;
    seller: string;
  }): Promise<void> {
    const listing = this.requireListing(params.listingId);
    if (!listing.active) throw new PortError('Listing is not active');
    if (listing.seller !== params.seller) {
      throw new PortError('Only the seller can cancel');
    }
    listing.active = false;
    for (const o of this.store.offers) {
      if (
        String(o.listingId) === String(listing.listingId) &&
        o.status === 'pending'
      ) {
        o.status = 'cancelled';
      }
    }
    this.persist();
  }

  async listActive(): Promise<TradeListing[]> {
    return this.store.listings.filter((l) => l.active).map((l) => ({ ...l }));
  }

  async listOffers(listingId: string | number): Promise<TradeOffer[]> {
    return this.store.offers
      .filter((o) => String(o.listingId) === String(listingId))
      .map((o) => ({ ...o, offerTokenIds: [...o.offerTokenIds] }));
  }

  isTokenListed(tokenId: TokenId): boolean {
    return this.isActiveHere(tokenId);
  }

  private isActiveHere(tokenId: TokenId): boolean {
    return this.store.listings.some((l) => l.active && l.tokenId === tokenId);
  }

  private requireListing(listingId: string | number): TradeListing {
    const listing = this.store.listings.find(
      (l) => String(l.listingId) === String(listingId)
    );
    if (!listing) throw new PortError(`Trade listing not found: ${listingId}`);
    return listing;
  }

  private requireOffer(offerId: string | number): TradeOffer {
    const offer = this.store.offers.find(
      (o) => String(o.offerId) === String(offerId)
    );
    if (!offer) throw new PortError(`Offer not found: ${offerId}`);
    return offer;
  }
}

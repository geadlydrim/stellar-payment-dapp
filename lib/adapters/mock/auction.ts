import type { ItemRegistry, TokenId } from '@/lib/registry';
import type { AuctionListing, AuctionPort } from '@/lib/ports';
import {
  PortError,
  findItemByTokenId,
  nextId,
  parseXlm,
  requireListableOwned,
  transferItemOwner,
} from './helpers';

export interface MockAuctionStore {
  auctions: AuctionListing[];
}

export interface MockAuctionPortOptions {
  registry: ItemRegistry;
  store: MockAuctionStore;
  persist: () => void;
  isTokenBusyElsewhere: (tokenId: TokenId) => boolean;
}

type SettledHandler = (e: {
  auctionId: string | number;
  tokenId: TokenId;
  winner: string;
}) => void;

/**
 * In-memory NFT auction for the Marketplace Auction tab.
 */
export class MockAuctionPort implements AuctionPort {
  private readonly registry: ItemRegistry;
  private readonly store: MockAuctionStore;
  private readonly persist: () => void;
  private readonly isTokenBusyElsewhere: (tokenId: TokenId) => boolean;
  private readonly settledHandlers = new Set<SettledHandler>();

  constructor(options: MockAuctionPortOptions) {
    this.registry = options.registry;
    this.store = options.store;
    this.persist = options.persist;
    this.isTokenBusyElsewhere = options.isTokenBusyElsewhere;
  }

  async listNftAuction(params: {
    tokenId: TokenId;
    seller: string;
    startPriceXlm: string;
    durationSec: number;
  }): Promise<AuctionListing> {
    requireListableOwned(this.registry, params.tokenId, params.seller);
    parseXlm(params.startPriceXlm);
    if (params.durationSec <= 0) {
      throw new PortError('durationSec must be > 0');
    }
    if (this.isActiveHere(params.tokenId) || this.isTokenBusyElsewhere(params.tokenId)) {
      throw new PortError('Token is already listed on the marketplace');
    }

    const auction: AuctionListing = {
      auctionId: nextId('auc'),
      tokenId: params.tokenId,
      seller: params.seller,
      startPriceXlm: params.startPriceXlm,
      endTime: Date.now() + params.durationSec * 1000,
      highestBidXlm: undefined,
      highestBidder: null,
    };
    this.store.auctions.push(auction);
    this.persist();
    return { ...auction };
  }

  async placeBid(params: {
    auctionId: string | number;
    bidder: string;
    amountXlm: string;
  }): Promise<void> {
    const auction = this.requireAuction(params.auctionId);
    if (Date.now() >= auction.endTime) {
      throw new PortError('Auction has ended');
    }
    if (auction.seller === params.bidder) {
      throw new PortError('Seller cannot bid');
    }
    const amount = parseXlm(params.amountXlm);
    const min = auction.highestBidXlm
      ? Number(auction.highestBidXlm)
      : Number(auction.startPriceXlm);
    if (amount <= min && auction.highestBidXlm) {
      throw new PortError(`Bid must be higher than ${auction.highestBidXlm} XLM`);
    }
    if (!auction.highestBidXlm && amount < min) {
      throw new PortError(`Bid must be at least ${auction.startPriceXlm} XLM`);
    }

    auction.highestBidXlm = params.amountXlm;
    auction.highestBidder = params.bidder;
    this.persist();
  }

  async close(params: {
    auctionId: string | number;
    caller: string;
  }): Promise<void> {
    const auction = this.requireAuction(params.auctionId);
    if (Date.now() < auction.endTime && params.caller !== auction.seller) {
      throw new PortError('Auction still running — only seller can force-close in mock');
    }

    const item = findItemByTokenId(this.registry, auction.tokenId);
    if (!item) throw new PortError('Auction item missing from registry');

    // Remove from active list by setting endTime in the past and clearing via filter
    const winner = auction.highestBidder;
    if (winner) {
      transferItemOwner(this.registry, item.id, winner);
      for (const h of this.settledHandlers) {
        h({
          auctionId: auction.auctionId,
          tokenId: auction.tokenId,
          winner,
        });
      }
    }

    // Mark closed by zeroing remaining time and moving out of "active"
    auction.endTime = Math.min(auction.endTime, Date.now() - 1);
    (auction as AuctionListing & { closed?: boolean }).closed = true;
    this.persist();
  }

  async listActive(): Promise<AuctionListing[]> {
    return this.store.auctions
      .filter((a) => !isClosed(a) && Date.now() < a.endTime)
      .map((a) => ({ ...a }));
  }

  /** Include ended-but-not-closed for UI settlement. */
  async listAll(): Promise<AuctionListing[]> {
    return this.store.auctions
      .filter((a) => !isClosed(a))
      .map((a) => ({ ...a }));
  }

  onSettled(handler: SettledHandler): () => void {
    this.settledHandlers.add(handler);
    return () => this.settledHandlers.delete(handler);
  }

  isTokenListed(tokenId: TokenId): boolean {
    return this.store.auctions.some(
      (a) => a.tokenId === tokenId && !isClosed(a)
    );
  }

  private isActiveHere(tokenId: TokenId): boolean {
    return this.store.auctions.some(
      (a) => a.tokenId === tokenId && !isClosed(a) && Date.now() < a.endTime
    );
  }

  private requireAuction(auctionId: string | number): AuctionListing {
    const auction = this.store.auctions.find(
      (a) => String(a.auctionId) === String(auctionId) && !isClosed(a)
    );
    if (!auction) throw new PortError(`Auction not found: ${auctionId}`);
    return auction;
  }
}

function isClosed(a: AuctionListing): boolean {
  return Boolean((a as AuctionListing & { closed?: boolean }).closed);
}

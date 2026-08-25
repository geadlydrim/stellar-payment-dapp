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
      throw new PortError('Enter a duration greater than 0 seconds.');
    }
    if (this.isActiveHere(params.tokenId) || this.isTokenBusyElsewhere(params.tokenId)) {
      throw new PortError('This NFT is already listed.');
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
      throw new PortError('This auction has already ended.');
    }
    if (auction.seller === params.bidder) {
      throw new PortError("You can't bid on your own auction.");
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
      throw new PortError(
        'This auction is still running. Wait for the timer, then settle.'
      );
    }

    const item = findItemByTokenId(this.registry, auction.tokenId, auction.seller);
    if (!item) throw new PortError("That auction's item is missing. Refresh and try again.");

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
    if (!auction) throw new PortError('Auction not found.');
    return auction;
  }
}

function isClosed(a: AuctionListing): boolean {
  return Boolean((a as AuctionListing & { closed?: boolean }).closed);
}

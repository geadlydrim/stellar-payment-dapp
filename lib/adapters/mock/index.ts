import type { ItemRegistry, TokenId } from '@/lib/registry';
import type {
  AuctionPort,
  FixedPricePort,
  NftBridge,
  OfferBoardPort,
} from '@/lib/ports';
import { MockNftBridge } from './nft-bridge';
import { MockFixedPricePort, type MockFixedPriceStore } from './fixed-price';
import { MockAuctionPort, type MockAuctionStore } from './auction';
import {
  MockOfferBoardPort,
  type MockOfferBoardStore,
} from './offer-board';

const STORAGE_KEY = 'stellar4:mock-market';

export interface MockMarketPorts {
  nftBridge: NftBridge;
  fixedPrice: MockFixedPricePort;
  auction: MockAuctionPort;
  offerBoard: MockOfferBoardPort;
}

interface PersistedMarket {
  fixedPrice: MockFixedPriceStore;
  auction: MockAuctionStore;
  offerBoard: MockOfferBoardStore;
}

function emptyStore(): PersistedMarket {
  return {
    fixedPrice: { listings: [] },
    auction: { auctions: [] },
    offerBoard: { listings: [], offers: [] },
  };
}

function loadStore(): PersistedMarket {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as PersistedMarket;
    return {
      fixedPrice: { listings: parsed.fixedPrice?.listings ?? [] },
      auction: { auctions: parsed.auction?.auctions ?? [] },
      offerBoard: {
        listings: parsed.offerBoard?.listings ?? [],
        offers: parsed.offerBoard?.offers ?? [],
      },
    };
  } catch {
    return emptyStore();
  }
}

/**
 * Build mock ports sharing one Registry + listing store.
 * Stellar swap later: replace Mock* classes with Stellar* adapters; keep this factory shape.
 */
export function createMockMarketPorts(registry: ItemRegistry): MockMarketPorts {
  const data = loadStore();

  const persist = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota
    }
  };

  // Holders avoid circular const initializers while cross-checking busy tokens.
  const holders: {
    fixedPrice?: MockFixedPricePort;
    auction?: MockAuctionPort;
    offerBoard?: MockOfferBoardPort;
  } = {};

  const busyExcept = (
    except: 'fixedPrice' | 'auction' | 'offerBoard',
    tokenId: TokenId
  ): boolean => {
    if (except !== 'fixedPrice' && holders.fixedPrice?.isTokenListed(tokenId)) {
      return true;
    }
    if (except !== 'auction' && holders.auction?.isTokenListed(tokenId)) {
      return true;
    }
    if (except !== 'offerBoard' && holders.offerBoard?.isTokenListed(tokenId)) {
      return true;
    }
    return false;
  };

  const fixedPrice = new MockFixedPricePort({
    registry,
    store: data.fixedPrice,
    persist,
    isTokenBusyElsewhere: (tokenId) => busyExcept('fixedPrice', tokenId),
  });
  holders.fixedPrice = fixedPrice;

  const auction = new MockAuctionPort({
    registry,
    store: data.auction,
    persist,
    isTokenBusyElsewhere: (tokenId) => busyExcept('auction', tokenId),
  });
  holders.auction = auction;

  const offerBoard = new MockOfferBoardPort({
    registry,
    store: data.offerBoard,
    persist,
    isTokenBusyElsewhere: (tokenId) => busyExcept('offerBoard', tokenId),
  });
  holders.offerBoard = offerBoard;

  const nftBridge = new MockNftBridge({
    registry,
    isTokenListed: (tokenId) =>
      fixedPrice.isTokenListed(tokenId) ||
      auction.isTokenListed(tokenId) ||
      offerBoard.isTokenListed(tokenId),
  });

  return { nftBridge, fixedPrice, auction, offerBoard };
}

let singleton: MockMarketPorts | null = null;
let singletonRegistry: ItemRegistry | null = null;

/**
 * App-wide mock ports bound to the Game registry singleton.
 * Call from client components only (uses localStorage).
 */
export function getMockMarketPorts(registry: ItemRegistry): MockMarketPorts {
  if (!singleton || singletonRegistry !== registry) {
    singleton = createMockMarketPorts(registry);
    singletonRegistry = registry;
  }
  return singleton;
}

/** Test helper: drop cached ports so the next get recreates them. */
export function resetMockMarketPorts(): void {
  singleton = null;
  singletonRegistry = null;
}

// Re-export port types for consumers that only need the interface surface
export type { FixedPricePort, AuctionPort, OfferBoardPort, NftBridge };

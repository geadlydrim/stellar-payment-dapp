/**
 * Composition root for Marketplace ports.
 * Default: mock. Stellar only when NEXT_PUBLIC_MARKET_ADAPTER=stellar and all
 * Phase D contract IDs are set (see .env.example / contracts/README.md).
 *
 * Stellar modules load via require() only when selected — Game can import this
 * file without a static dependency on @stellar/* or lib/soroban.
 */

import type { ItemRegistry } from '@/lib/registry';
import type {
  AuctionPort,
  FixedPricePort,
  NftBridge,
  OfferBoardPort,
} from '@/lib/ports';
import {
  createMockMarketPorts,
  getMockMarketPorts,
  resetMockMarketPorts,
  type MockMarketPorts,
} from './mock';
import {
  canUseStellarAdapter,
  resolveMarketAdapterKind,
  type MarketAdapterKind,
} from './stellar/env';

export type { NftBridge } from '@/lib/ports';
export {
  createMockMarketPorts,
  getMockMarketPorts,
  resetMockMarketPorts,
  type MockMarketPorts,
} from './mock';
export {
  canUseStellarAdapter,
  resolveMarketAdapterKind,
  type MarketAdapterKind,
} from './stellar/env';
export { PortError } from './helpers';

export interface MarketPorts {
  nftBridge: NftBridge;
  fixedPrice: FixedPricePort;
  auction: AuctionPort;
  offerBoard: OfferBoardPort;
  /** Which adapter the composition root selected. */
  adapter: MarketAdapterKind;
}

type StellarBundle = typeof import('./stellar');

let stellarSingleton: MarketPorts | null = null;
let stellarRegistry: ItemRegistry | null = null;

function loadStellar(): StellarBundle {
  // Sync load keeps getMarketPorts sync for client UI; only runs when stellar is selected.
  // Dynamic require avoids a static @stellar/* edge into Game when adapter=mock.
  const loader = require as NodeRequire;
  return loader('./stellar') as StellarBundle;
}

/**
 * App-wide ports: mock (default) or stellar when env + IDs allow.
 * Client components only (mock uses localStorage; stellar uses wallet).
 */
export function getMarketPorts(registry: ItemRegistry): MarketPorts {
  const kind = resolveMarketAdapterKind();

  if (kind === 'stellar') {
    if (!stellarSingleton || stellarRegistry !== registry) {
      const { createStellarMarketPorts } = loadStellar();
      const ports = createStellarMarketPorts(registry);
      stellarSingleton = ports;
      stellarRegistry = registry;
    }
    return stellarSingleton;
  }

  const mock = getMockMarketPorts(registry);
  return { ...mock, adapter: 'mock' };
}

/** Explicit factory (tests / one-offs) — does not touch singletons. */
export function createMarketPorts(
  registry: ItemRegistry,
  kind: MarketAdapterKind = resolveMarketAdapterKind()
): MarketPorts {
  if (kind === 'stellar') {
    if (!canUseStellarAdapter()) {
      throw new Error(
        'createMarketPorts(stellar) requires NEXT_PUBLIC_MARKET_ADAPTER=stellar and all contract IDs'
      );
    }
    return loadStellar().createStellarMarketPorts(registry);
  }
  const mock = createMockMarketPorts(registry);
  return { ...mock, adapter: 'mock' };
}

/** Drop cached stellar + mock singletons (tests). */
export function resetMarketPorts(): void {
  stellarSingleton = null;
  stellarRegistry = null;
  resetMockMarketPorts();
}

/** Re-export stellar types without forcing a runtime load. */
export type { StellarMarketPorts, StellarContractIds } from './stellar';

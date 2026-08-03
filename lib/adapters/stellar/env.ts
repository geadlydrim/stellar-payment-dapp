/**
 * Env + deploy ID helpers for Stellar marketplace adapters.
 * Adapter stays off (composition falls back to mock) unless IDs are present.
 */

export type MarketAdapterKind = 'mock' | 'stellar';

export interface StellarContractIds {
  itemNft: string;
  auction: string;
  fixedPrice: string;
  offerBoard: string;
}

function trimId(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && v.length > 0 && !v.includes('placeholder') ? v : undefined;
}

export function readStellarContractIds(): Partial<StellarContractIds> {
  return {
    itemNft: trimId(process.env.NEXT_PUBLIC_ITEM_NFT_CONTRACT_ID),
    auction: trimId(process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ID),
    fixedPrice: trimId(process.env.NEXT_PUBLIC_FIXED_PRICE_CONTRACT_ID),
    offerBoard: trimId(process.env.NEXT_PUBLIC_OFFER_BOARD_CONTRACT_ID),
  };
}

export function requireStellarContractIds(): StellarContractIds {
  const ids = readStellarContractIds();
  const missing: string[] = [];
  if (!ids.itemNft) missing.push('NEXT_PUBLIC_ITEM_NFT_CONTRACT_ID');
  if (!ids.auction) missing.push('NEXT_PUBLIC_AUCTION_CONTRACT_ID');
  if (!ids.fixedPrice) missing.push('NEXT_PUBLIC_FIXED_PRICE_CONTRACT_ID');
  if (!ids.offerBoard) missing.push('NEXT_PUBLIC_OFFER_BOARD_CONTRACT_ID');
  if (missing.length > 0) {
    throw new Error(
      `Stellar market adapter needs deployed contract IDs: ${missing.join(', ')}. See contracts/README.md.`
    );
  }
  return ids as StellarContractIds;
}

/** True when env asks for stellar AND all four Phase D IDs are set. */
export function canUseStellarAdapter(): boolean {
  const kind = (process.env.NEXT_PUBLIC_MARKET_ADAPTER || 'mock')
    .trim()
    .toLowerCase();
  if (kind !== 'stellar') return false;
  const ids = readStellarContractIds();
  return Boolean(
    ids.itemNft && ids.auction && ids.fixedPrice && ids.offerBoard
  );
}

export function resolveMarketAdapterKind(): MarketAdapterKind {
  return canUseStellarAdapter() ? 'stellar' : 'mock';
}

import type { ItemRegistry, TokenId } from '@/lib/registry';
import type {
  AuctionPort,
  FixedPricePort,
  NftBridge,
  OfferBoardPort,
} from '@/lib/ports';
import { requireStellarContractIds, type StellarContractIds } from './env';
import { StellarNftBridge } from './nft-bridge';
import { StellarFixedPricePort } from './fixed-price';
import { StellarAuctionPort } from './auction';
import { StellarOfferBoardPort } from './offer-board';

export {
  canUseStellarAdapter,
  readStellarContractIds,
  requireStellarContractIds,
  resolveMarketAdapterKind,
  type MarketAdapterKind,
  type StellarContractIds,
} from './env';
export { tokenIdToU32, u32ToTokenId, listingIdToU32 } from './ids';
export { StellarNftBridge } from './nft-bridge';
export { StellarFixedPricePort } from './fixed-price';
export { StellarAuctionPort } from './auction';
export { StellarOfferBoardPort } from './offer-board';
export { reconcileStellarAsNft } from './reconcile';

export interface StellarMarketPorts {
  nftBridge: NftBridge;
  fixedPrice: FixedPricePort & {
    isTokenListed?: (tokenId: TokenId) => boolean | Promise<boolean>;
  };
  auction: AuctionPort & {
    isTokenListed?: (tokenId: TokenId) => boolean | Promise<boolean>;
    listAll?: () => Promise<import('@/lib/ports').AuctionListing[]>;
  };
  offerBoard: OfferBoardPort & {
    isTokenListed?: (tokenId: TokenId) => boolean | Promise<boolean>;
  };
  adapter: 'stellar';
  contracts: StellarContractIds;
}

/**
 * Build Stellar adapters sharing one Registry + contract IDs.
 * Call only when `canUseStellarAdapter()` is true (or after requireStellarContractIds).
 */
export function createStellarMarketPorts(
  registry: ItemRegistry,
  contracts: StellarContractIds = requireStellarContractIds()
): StellarMarketPorts {
  const holders: {
    fixedPrice?: StellarFixedPricePort;
    auction?: StellarAuctionPort;
    offerBoard?: StellarOfferBoardPort;
  } = {};

  const busyExcept = async (
    except: 'fixedPrice' | 'auction' | 'offerBoard',
    tokenId: TokenId
  ): Promise<boolean> => {
    if (
      except !== 'fixedPrice' &&
      holders.fixedPrice &&
      (await holders.fixedPrice.isTokenListed(tokenId))
    ) {
      return true;
    }
    if (
      except !== 'auction' &&
      holders.auction &&
      (await holders.auction.isTokenListed(tokenId))
    ) {
      return true;
    }
    if (
      except !== 'offerBoard' &&
      holders.offerBoard &&
      (await holders.offerBoard.isTokenListed(tokenId))
    ) {
      return true;
    }
    return false;
  };

  const fixedPrice = new StellarFixedPricePort({
    registry,
    contracts,
    isTokenBusyElsewhere: (tokenId) => busyExcept('fixedPrice', tokenId),
  });
  holders.fixedPrice = fixedPrice;

  const auction = new StellarAuctionPort({
    registry,
    contracts,
    isTokenBusyElsewhere: (tokenId) => busyExcept('auction', tokenId),
  });
  holders.auction = auction;

  const offerBoard = new StellarOfferBoardPort({
    registry,
    contracts,
    isTokenBusyElsewhere: (tokenId) => busyExcept('offerBoard', tokenId),
  });
  holders.offerBoard = offerBoard;

  const nftBridge = new StellarNftBridge({
    registry,
    contracts,
    isTokenListed: async (tokenId) =>
      (await fixedPrice.isTokenListed(tokenId)) ||
      (await auction.isTokenListed(tokenId)) ||
      (await offerBoard.isTokenListed(tokenId)),
  });

  return {
    nftBridge,
    fixedPrice,
    auction,
    offerBoard,
    adapter: 'stellar',
    contracts,
  };
}

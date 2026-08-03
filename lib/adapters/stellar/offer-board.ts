import type { ItemRegistry, TokenId } from '@/lib/registry';
import type { OfferBoardPort, TradeListing, TradeOffer } from '@/lib/ports';
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
  stringScVal,
  u32ScVal,
  u32VecScVal,
  viewOrThrow,
  xlmToStroops,
} from './sc';

export interface StellarOfferBoardPortOptions {
  registry: ItemRegistry;
  contracts: StellarContractIds;
  isTokenBusyElsewhere: (tokenId: TokenId) => boolean | Promise<boolean>;
}

export class StellarOfferBoardPort implements OfferBoardPort {
  private readonly registry: ItemRegistry;
  private readonly contracts: StellarContractIds;
  private readonly isTokenBusyElsewhere: (
    tokenId: TokenId
  ) => boolean | Promise<boolean>;

  constructor(options: StellarOfferBoardPortOptions) {
    this.registry = options.registry;
    this.contracts = options.contracts;
    this.isTokenBusyElsewhere = options.isTokenBusyElsewhere;
  }

  async listForOffers(params: {
    tokenId: TokenId;
    seller: string;
    wantsHint?: string;
  }): Promise<TradeListing> {
    await requireListableChainOwner(
      this.registry,
      this.contracts.itemNft,
      params.tokenId,
      params.seller
    );
    if (
      (await this.isActiveHere(params.tokenId)) ||
      (await this.isTokenBusyElsewhere(params.tokenId))
    ) {
      throw new PortError('Token is already listed on the marketplace');
    }

    const hint = params.wantsHint ?? '';
    const result = await invokeOrThrow(
      this.contracts.offerBoard,
      'list_for_offers',
      [
        addressScVal(params.seller),
        u32ScVal(tokenIdToU32(params.tokenId)),
        stringScVal(hint),
      ],
      params.seller
    );

    const listingId =
      result.returnValue !== undefined && result.returnValue !== null
        ? Number(result.returnValue as number | bigint)
        : undefined;
    if (listingId === undefined || !Number.isInteger(listingId)) {
      throw new PortError('list_for_offers returned no listing id');
    }

    return {
      listingId,
      tokenId: params.tokenId,
      seller: params.seller,
      wantsHint: params.wantsHint,
      active: true,
    };
  }

  async submitOffer(params: {
    listingId: string | number;
    buyer: string;
    xlm: string;
    offerTokenIds: TokenId[];
  }): Promise<TradeOffer> {
    assertStellarAddress(params.buyer, 'buyer');
    parseXlm(params.xlm);
    const offerTokenIds = params.offerTokenIds ?? [];
    if (Number(params.xlm) <= 0 && offerTokenIds.length === 0) {
      throw new PortError('Offer must include XLM and/or at least one tokenId');
    }

    const listingId = listingIdToU32(params.listingId);
    const listing = await this.getListingRaw(listingId);
    if (!listing.active) throw new PortError('Trade listing is not active');
    if (String(listing.seller) === params.buyer) {
      throw new PortError('Cannot offer on your own listing');
    }

    for (const tid of offerTokenIds) {
      await requireListableChainOwner(
        this.registry,
        this.contracts.itemNft,
        tid,
        params.buyer
      );
      if (tid === u32ToTokenId(listing.token_id as number | bigint)) {
        throw new PortError('Cannot offer the listed token itself');
      }
    }

    const result = await invokeOrThrow(
      this.contracts.offerBoard,
      'submit_offer',
      [
        u32ScVal(listingId),
        addressScVal(params.buyer),
        i128ScVal(xlmToStroops(params.xlm)),
        u32VecScVal(offerTokenIds.map(tokenIdToU32)),
      ],
      params.buyer
    );

    const offerId =
      result.returnValue !== undefined && result.returnValue !== null
        ? Number(result.returnValue as number | bigint)
        : undefined;
    if (offerId === undefined || !Number.isInteger(offerId)) {
      throw new PortError('submit_offer returned no offer id');
    }

    return {
      offerId,
      listingId,
      buyer: params.buyer,
      xlm: params.xlm,
      offerTokenIds: [...offerTokenIds],
      status: 'pending',
    };
  }

  async acceptOffer(params: {
    offerId: string | number;
    seller: string;
  }): Promise<void> {
    assertStellarAddress(params.seller, 'seller');
    const offerId = listingIdToU32(params.offerId);
    const offer = await this.getOfferRaw(offerId);
    const listing = await this.getListingRaw(Number(offer.listing_id));
    if (!listing.active) throw new PortError('Trade listing is not active');
    if (String(listing.seller) !== params.seller) {
      throw new PortError('Only the seller can accept');
    }

    const listedTokenId = u32ToTokenId(listing.token_id as number | bigint);
    const listedItem = findItemByTokenId(this.registry, listedTokenId);
    if (!listedItem) throw new PortError('Listed item missing');

    const buyer = String(offer.buyer);
    const offeredIds = parseTokenIdVec(offer.offer_token_ids);

    await invokeOrThrow(
      this.contracts.offerBoard,
      'accept_offer',
      [u32ScVal(offerId), addressScVal(params.seller)],
      params.seller
    );

    // CONTRACTS v2 owner sync after settle
    transferItemOwner(this.registry, listedItem.id, buyer);
    for (const tid of offeredIds) {
      const offered = findItemByTokenId(this.registry, tid);
      if (offered) transferItemOwner(this.registry, offered.id, params.seller);
    }
  }

  async rejectOffer(params: {
    offerId: string | number;
    seller: string;
  }): Promise<void> {
    assertStellarAddress(params.seller, 'seller');
    await invokeOrThrow(
      this.contracts.offerBoard,
      'reject_offer',
      [u32ScVal(listingIdToU32(params.offerId)), addressScVal(params.seller)],
      params.seller
    );
  }

  async cancelListing(params: {
    listingId: string | number;
    seller: string;
  }): Promise<void> {
    assertStellarAddress(params.seller, 'seller');
    await invokeOrThrow(
      this.contracts.offerBoard,
      'cancel_listing',
      [u32ScVal(listingIdToU32(params.listingId)), addressScVal(params.seller)],
      params.seller
    );
  }

  async listActive(): Promise<TradeListing[]> {
    const raw = await viewOrThrow(this.contracts.offerBoard, 'list_active', []);
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => this.mapListing(row as Record<string, unknown>));
  }

  async listOffers(listingId: string | number): Promise<TradeOffer[]> {
    const raw = await viewOrThrow(this.contracts.offerBoard, 'list_offers', [
      u32ScVal(listingIdToU32(listingId)),
    ]);
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => this.mapOffer(row as Record<string, unknown>));
  }

  async isTokenListed(tokenId: TokenId): Promise<boolean> {
    return this.isActiveHere(tokenId);
  }

  private async isActiveHere(tokenId: TokenId): Promise<boolean> {
    const active = await this.listActive();
    return active.some((l) => l.tokenId === tokenId && l.active);
  }

  private async getListingRaw(id: number): Promise<Record<string, unknown>> {
    const raw = await viewOrThrow(this.contracts.offerBoard, 'get_listing', [
      u32ScVal(id),
    ]);
    if (!raw || typeof raw !== 'object') {
      throw new PortError(`Trade listing not found: ${id}`);
    }
    return raw as Record<string, unknown>;
  }

  private async getOfferRaw(id: number): Promise<Record<string, unknown>> {
    const raw = await viewOrThrow(this.contracts.offerBoard, 'get_offer', [
      u32ScVal(id),
    ]);
    if (!raw || typeof raw !== 'object') {
      throw new PortError(`Offer not found: ${id}`);
    }
    return raw as Record<string, unknown>;
  }

  private mapListing(raw: Record<string, unknown>): TradeListing {
    const hint = String(raw.wants_hint ?? '');
    return {
      listingId: Number(raw.id ?? 0),
      tokenId: u32ToTokenId(raw.token_id as number | bigint),
      seller: String(raw.seller ?? ''),
      wantsHint: hint || undefined,
      active: Boolean(raw.active),
    };
  }

  private mapOffer(raw: Record<string, unknown>): TradeOffer {
    return {
      offerId: Number(raw.id ?? 0),
      listingId: Number(raw.listing_id ?? 0),
      buyer: String(raw.buyer ?? ''),
      xlm: stroopsToXlm(raw.xlm as number | bigint),
      offerTokenIds: parseTokenIdVec(raw.offer_token_ids),
      status: mapOfferStatus(raw.status),
    };
  }
}

function parseTokenIdVec(raw: unknown): TokenId[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => u32ToTokenId(id as number | bigint));
}

function mapOfferStatus(
  raw: unknown
): TradeOffer['status'] {
  const s =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object' && raw !== null
        ? Object.keys(raw as object)[0] ?? String(raw)
        : String(raw ?? 'pending');
  const lower = s.toLowerCase();
  if (lower.includes('accept')) return 'accepted';
  if (lower.includes('reject')) return 'rejected';
  if (lower.includes('cancel')) return 'cancelled';
  return 'pending';
}

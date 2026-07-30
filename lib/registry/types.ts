/**
 * Item domain types — Contracts v2 (docs/team/CONTRACTS.md).
 * Do not invent parallel field names; propose a CONTRACTS bump instead.
 */

/** Stable game-side id (not the NFT token id). */
export type ItemId = string;

/** On-chain NFT id once exported (opaque string for now). */
export type TokenId = string;

export type ItemState = 'InGame' | 'LockedForTrade' | 'AsNft';

export interface ItemMeta {
  name: string;
  description: string;
  /** e.g. weapon | relic | consumable */
  kind: string;
  /** Game-balance fields — opaque to marketplace */
  attrs?: Record<string, number | string>;
}

export interface Item {
  id: ItemId;
  ownerId: string; // player id or wallet pubkey later
  meta: ItemMeta;
  state: ItemState;
  /** Set only when state === AsNft */
  tokenId?: TokenId;
  updatedAt: number; // unix ms
}

export interface ItemRegistry {
  get(id: ItemId): Item | undefined;
  listByOwner(ownerId: string): Item[];
  create(ownerId: string, meta: ItemMeta): Item;

  /** InGame → LockedForTrade. Fails if not InGame or wrong owner. */
  lockForTrade(id: ItemId, ownerId: string): Item;

  /** LockedForTrade → InGame. */
  unlock(id: ItemId, ownerId: string): Item;

  /** LockedForTrade → AsNft; attaches tokenId. */
  markAsNft(id: ItemId, tokenId: TokenId): Item;

  /** AsNft → InGame; clears tokenId. */
  markInGame(id: ItemId): Item;
}

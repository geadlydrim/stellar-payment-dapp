# Auction Contract — Deploy Guide

Multi-auction XLM escrow for Stellar4 Marketplace **Auction** tab (`AuctionPort`).

- **Legacy:** `create_auction` — description-only listing; XLM escrow only (unchanged behavior).
- **NFT:** `create_nft_auction` — escrows an `item-nft` token; on `close`, NFT transfers to the winner (or back to seller if no bids).

Amounts are **stroops** (`i128`). `1 XLM = 10_000_000` stroops.

## Migration (existing XLM deployments)

| Change | Impact |
|--------|--------|
| `AuctionData` adds `nft_contract: Option<Address>`, `token_id: Option<u32>` | **Storage layout change** — redeploy; do not reuse an old contract ID for NFT auctions |
| `create_auction(...)` | Still works on the new WASM (sets NFT fields to `None`) |
| `create_nft_auction(...)` | New; requires deployed `item-nft` |
| `close` event data | NFT closes may include `token_id` in data; legacy closes unchanged |
| Frontend `.env` | Point `NEXT_PUBLIC_AUCTION_CONTRACT_ID` at the **new** deploy after NFT settle ships |

Old testnet contracts remain valid for legacy BidDrift UI until cut over. Marketplace `AuctionPort` should use the redeployed ID.

## Prerequisites

Same as before: Rust (`wasm32v1-none` / `wasm32-unknown-unknown`), Stellar CLI, funded testnet identity.

## Build

From **contracts workspace** or this crate:

```bash
cd contracts/auction
stellar contract build
# WASM: target/wasm32v1-none/release/auction.wasm  (path may vary by CLI)
```

## Test

```bash
cd contracts
cargo test -p auction
```

## Deploy to testnet

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/auction.wasm \
  --source alice \
  --network testnet
# → AUCTION_CONTRACT_ID=C...

NATIVE_SAC=$(stellar contract id asset --asset native --network testnet)

stellar contract invoke \
  --id $AUCTION_CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --token $NATIVE_SAC
```

Wire frontend:

```bash
NEXT_PUBLIC_AUCTION_CONTRACT_ID=C...your_deployed_id...
NEXT_PUBLIC_ITEM_NFT_CONTRACT_ID=C...item_nft_id...
```

## NFT auction smoke

```bash
# After item-nft is deployed, minted to seller, and seller is ready:
stellar contract invoke \
  --id $AUCTION_CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  create_nft_auction \
  --seller $(stellar keys address alice) \
  --nft_contract $ITEM_NFT_CONTRACT_ID \
  --token_id 0 \
  --start_price 10000000 \
  --duration 3600
```

## Contract API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(token)` | none | Set native SAC once |
| `create_auction(seller, item, description, start_price, duration)` | seller | Legacy XLM-only auction |
| `create_nft_auction(seller, nft_contract, token_id, start_price, duration)` | seller | Escrow NFT + create |
| `bid(id, bidder, amount)` | bidder | Escrow bid, refund previous |
| `close(id)` | none | Pay seller; transfer NFT if present |
| `get_auction(id)` | view | Single auction |
| `list_auctions()` | view | All auctions |

### Errors

| Code | Name | Meaning |
|------|------|---------|
| 1–9 | (unchanged) | Same as legacy auction |
| 10 | NotNftOwner | Seller does not own NFT at list time |

### Events

Topics: `("auction", "created"|"bid"|"closed", id)`.

- `created` data: `seller` (legacy) or `(seller, token_id)` (NFT)
- `bid` data: `(bidder, amount)`
- `closed` data: `(winner, payout)` / `(winner, payout, token_id)` / `()` if no bids

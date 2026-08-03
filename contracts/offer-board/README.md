# Offer-Board Contract

Stellar4 Marketplace **Trade** tab — open-to-offers listings (`OfferBoardPort`).

Seller lists an NFT (escrowed). Buyers submit offers with XLM and/or other NFT `token_id`s (escrowed). Seller accept/reject is explicit — not a silent swap.

## Build / test

```bash
cd contracts
cargo test -p offer-board

cd offer-board
stellar contract build
# WASM: target/wasm32v1-none/release/offer_board.wasm
```

## Deploy (testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/offer_board.wasm \
  --source alice \
  --network testnet
# → OFFER_BOARD_CONTRACT_ID=C...

NATIVE_SAC=$(stellar contract id asset --asset native --network testnet)

stellar contract invoke \
  --id $OFFER_BOARD_CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --xlm_token $NATIVE_SAC \
  --nft_contract $ITEM_NFT_CONTRACT_ID
```

Env placeholder:

```bash
NEXT_PUBLIC_OFFER_BOARD_CONTRACT_ID=C...placeholder...
```

## API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(xlm_token, nft_contract)` | none | Once |
| `list_for_offers(seller, token_id, wants_hint)` | seller | Escrow listed NFT |
| `submit_offer(listing_id, buyer, xlm, offer_token_ids)` | buyer | Escrow XLM and/or NFTs |
| `accept_offer(offer_id, seller)` | seller | Settle; reject other pending |
| `reject_offer(offer_id, seller)` | seller | Refund offer escrow |
| `cancel_listing(listing_id, seller)` | seller | Return listed NFT; refund pending |
| `get_listing` / `get_offer` / `list_active` / `list_offers` | view | |

On accept: listed NFT → buyer; offered XLM + NFTs → seller.

### Events (`trade`)

| Topics | Data |
|--------|------|
| `("trade", "listed", id)` | `(seller, token_id)` |
| `("trade", "offer", offer_id)` | `(listing_id, buyer)` |
| `("trade", "accept", offer_id)` | `listing_id` |
| `("trade", "reject", offer_id)` | `listing_id` |
| `("trade", "cancel", listing_id)` | `seller` |

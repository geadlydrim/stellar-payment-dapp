# Fixed-Price Contract

Stellar4 Marketplace **Sale** tab — list / buy / cancel (`FixedPricePort`).

Escrows the NFT on list; on buy transfers XLM to seller and NFT to buyer via inter-contract `item-nft.transfer`.

## Build / test

```bash
cd contracts
cargo test -p fixed-price

cd fixed-price
stellar contract build
# WASM: target/wasm32v1-none/release/fixed_price.wasm
```

## Deploy (testnet)

Requires deployed native SAC + `item-nft`.

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fixed_price.wasm \
  --source alice \
  --network testnet
# → FIXED_PRICE_CONTRACT_ID=C...

NATIVE_SAC=$(stellar contract id asset --asset native --network testnet)

stellar contract invoke \
  --id $FIXED_PRICE_CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --xlm_token $NATIVE_SAC \
  --nft_contract $ITEM_NFT_CONTRACT_ID
```

Env placeholder:

```bash
NEXT_PUBLIC_FIXED_PRICE_CONTRACT_ID=C...placeholder...
```

## API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(xlm_token, nft_contract)` | none | Once |
| `list(seller, token_id, price)` | seller | Escrow NFT; price in stroops |
| `buy(listing_id, buyer)` | buyer | Pay seller; NFT → buyer; returns `token_id` |
| `cancel(listing_id, seller)` | seller | Return NFT |
| `get_listing(id)` | view | |
| `list_active()` | view | Active listings |

### Events (`sale`)

| Topics | Data |
|--------|------|
| `("sale", "listed", id)` | `(seller, token_id, price)` |
| `("sale", "sold", id)` | `(buyer, token_id)` |
| `("sale", "cancel", id)` | `seller` |

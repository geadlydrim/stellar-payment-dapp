# Item NFT Contract

Stellar4 item NFT for Marketplace settlement. Supports authorized mint, burn/redeem, and transfer. Marketplace contracts call `transfer` cross-contract to settle sales, auctions, and trades.

Maps to Integration **`NftBridge`**: mint on export, burn on import. On-chain `token_id` (`u32`) is stringified as port `TokenId`.

## Build

```bash
cd contracts/item-nft
stellar contract build
# WASM: target/wasm32v1-none/release/item_nft.wasm
```

## Test

```bash
cd contracts/item-nft
cargo test
```

## Deploy (testnet)

```bash
stellar keys generate alice --network testnet --fund   # if needed

stellar contract deploy \
  --wasm target/wasm32v1-none/release/item_nft.wasm \
  --source alice \
  --network testnet
# → ITEM_NFT_CONTRACT_ID=C...

stellar contract invoke \
  --id $ITEM_NFT_CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address alice)

# Optional: authorize a bridge/minter key
stellar contract invoke \
  --id $ITEM_NFT_CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  set_minter \
  --admin $(stellar keys address alice) \
  --minter <BRIDGE_ADDRESS> \
  --authorized true
```

Placeholder env (Integration / Platform):

```bash
NEXT_PUBLIC_ITEM_NFT_CONTRACT_ID=C...placeholder...
```

## API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(admin)` | none | One-time admin |
| `set_minter(admin, minter, authorized)` | admin | Grant/revoke mint |
| `mint(minter, to, item_id)` | minter | Mint; returns `token_id` |
| `burn(from, token_id)` | owner | Burn/redeem |
| `transfer(from, to, token_id)` | `from` | Transfer ownership |
| `owner_of(token_id)` | view | Current owner |
| `get_item_id(token_id)` | view | Registry item id string |
| `exists(token_id)` | view | Whether token exists |
| `is_minter(address)` | view | Mint authority (admin always true) |

### Events (poll via `getEvents`)

Topics: `("item_nft", "mint"|"burn"|"xfer", token_id)`.

| Topic | Data |
|-------|------|
| mint | `(to, item_id)` |
| burn | `(from, item_id)` |
| xfer | `(from, to)` |

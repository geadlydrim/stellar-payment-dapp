# Stellar4 Marketplace — Soroban contracts

Phase D on-chain settlement for Stellar4 Marketplace.

| Crate | Role | Port alignment |
|-------|------|----------------|
| [`item-nft/`](./item-nft/) | Mint / burn / transfer item NFTs | `NftBridge` |
| [`auction/`](./auction/) | XLM escrow + optional NFT settle on close | `AuctionPort` |
| [`fixed-price/`](./fixed-price/) | Fixed-price sale (XLM + NFT) | `FixedPricePort` |
| [`offer-board/`](./offer-board/) | Offer-board trade accept/reject | `OfferBoardPort` |

## Inter-contract flow

```
NftBridge.export  →  item-nft.mint
Marketplace list  →  NFT escrowed into auction | fixed-price | offer-board
Settle / buy / accept → market contract calls item-nft.transfer → buyer
NftBridge.import  →  item-nft.burn
```

XLM payments use the native SAC (`token::Client`).

## Workspace test / build

```bash
cd contracts
cargo test

# Per-crate WASM (from that crate directory, or with -p):
cd item-nft && stellar contract build
cd ../auction && stellar contract build
cd ../fixed-price && stellar contract build
cd ../offer-board && stellar contract build
```

WASM paths (typical):

```
target/wasm32v1-none/release/item_nft.wasm
target/wasm32v1-none/release/auction.wasm
target/wasm32v1-none/release/fixed_price.wasm
target/wasm32v1-none/release/offer_board.wasm
```

## Env placeholders (Integration)

```bash
NEXT_PUBLIC_ITEM_NFT_CONTRACT_ID=C...placeholder...
NEXT_PUBLIC_AUCTION_CONTRACT_ID=C...placeholder...   # redeploy for NFT settle ABI
NEXT_PUBLIC_FIXED_PRICE_CONTRACT_ID=C...placeholder...
NEXT_PUBLIC_OFFER_BOARD_CONTRACT_ID=C...placeholder...
NEXT_PUBLIC_MARKET_ADAPTER=mock   # Integration: flip to stellar when IDs are set (adapters in lib/adapters/stellar/)
```

## Events (for Integration polling)

| Contract | Topic prefix | Actions |
|----------|--------------|---------|
| item-nft | `item_nft` | `mint`, `burn`, `xfer` |
| auction | `auction` | `created`, `bid`, `closed` |
| fixed-price | `sale` | `listed`, `sold`, `cancel` |
| offer-board | `trade` | `listed`, `offer`, `accept`, `reject`, `cancel` |

See each crate README for deploy steps and payload shapes.

## Deploy order (testnet)

1. **item-nft** — deploy WASM → `initialize(admin)` → optional `set_minter` for the NftBridge key  
2. **auction** — deploy **new** WASM (NFT settle) → `initialize(native SAC)` — see [auction migration](./auction/README.md); do not reuse a pre-NFT auction ID for Marketplace  
3. **fixed-price** — deploy → `initialize(xlm_token, nft_contract)`  
4. **offer-board** — deploy → `initialize(xlm_token, nft_contract)`

Per-crate invoke examples live in each README. Copy resulting `C…` IDs into root `.env.example` / `.env.local`.

### Secrets

| Keep out of git | Use instead |
|-----------------|-------------|
| Identity secret / seed phrase | `stellar keys` local keystore only |
| `.env.local` with real IDs you treat as private ops notes | Committed `.env.example` placeholders only |
| CI deploy keys (none today) | Add GitHub Actions secrets only when a deploy job is introduced |

`NEXT_PUBLIC_*` values are embedded in the browser bundle — they are not server secrets, but still do not commit `.env.local`.

## Note for Platform / CI

- `cargo test` in `contracts/` is the contract unit-test entrypoint for CI (14 tests).
- If `cargo update` pulls `ed25519-dalek` 3.x, re-pin: `cargo update -p ed25519-dalek@3.0.0 --precise 2.2.0` (Soroban SDK 22 testutils).

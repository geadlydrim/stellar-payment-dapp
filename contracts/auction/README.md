# Auction Contract — Deploy Guide

Multi-auction escrow contract for BidDrift. Bids transfer native XLM into the contract; outbid bidders are refunded; the seller is paid on close.

Amounts are **stroops** (`i128`). `1 XLM = 10_000_000` stroops.

## Prerequisites

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
```

### 2. Install Stellar CLI

```bash
# Linux / macOS
curl -sSf https://raw.githubusercontent.com/stellar/stellar-cli/main/install.sh | sh

# Or via cargo
cargo install --locked stellar-cli --features opt

stellar --version
```

### 3. Configure a testnet identity

```bash
stellar keys generate alice --network testnet --fund
stellar keys address alice
```

## Build

From the **repo root**:

```bash
cd contracts/auction
stellar contract build
```

The WASM lands at:

```
target/wasm32-unknown-unknown/release/auction.wasm
```

(If you build with `cargo build --target wasm32-unknown-unknown --release` from this crate, the path may be under `contracts/auction/target/...` instead.)

## Deploy to testnet

```bash
# From contracts/auction (or pass the absolute WASM path)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/auction.wasm \
  --source alice \
  --network testnet
```

Copy the printed **contract ID** (starts with `C`).

## Get the native SAC address

```bash
stellar contract id asset --asset native --network testnet
```

This is the Stellar Asset Contract address for native XLM on testnet.

## Initialize the contract

```bash
stellar contract invoke \
  --id <AUCTION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --token <NATIVE_SAC_ADDRESS>
```

## Wire the frontend

Create `.env.local` in the repo root:

```bash
NEXT_PUBLIC_AUCTION_CONTRACT_ID=C...your_deployed_id...
```

Restart `npm run dev` after changing env vars.

## Quick smoke test (optional)

```bash
# Create an auction (start_price = 1 XLM = 10000000 stroops, duration = 3600s)
stellar contract invoke \
  --id <AUCTION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  create_auction \
  --seller $(stellar keys address alice) \
  --item "Vintage Watch" \
  --description "A classic piece" \
  --start_price 10000000 \
  --duration 3600

# List auctions
stellar contract invoke \
  --id <AUCTION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  list_auctions
```

## Contract API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(token)` | none | Set native SAC once |
| `create_auction(seller, item, description, start_price, duration)` | seller | Create auction, returns `id` |
| `bid(id, bidder, amount)` | bidder | Escrow bid, refund previous |
| `close(id)` | none | After `end_time`, pay seller |
| `get_auction(id)` | view | Single auction |
| `list_auctions()` | view | All auctions |

### Errors (`#[contracterror]`)

| Code | Name | Meaning |
|------|------|---------|
| 1 | NotInitialized | Call `initialize` first |
| 2 | AlreadyInitialized | Token already set |
| 3 | AuctionNotFound | Bad id |
| 4 | AuctionEnded | Bidding closed |
| 5 | BidTooLow | Must beat current / meet start |
| 6 | SelfBid | Seller cannot bid |
| 7 | NotEnded | Too early to close |
| 8 | AlreadySettled | Already closed |
| 9 | InvalidAmount | Non-positive amount / duration |

### Events

Topics: `("auction", "created"|"bid"|"closed", id)`.

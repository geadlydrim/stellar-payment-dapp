#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
    Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AuctionError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AuctionNotFound = 3,
    AuctionEnded = 4,
    BidTooLow = 5,
    SelfBid = 6,
    NotEnded = 7,
    AlreadySettled = 8,
    InvalidAmount = 9,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionData {
    pub id: u32,
    pub seller: Address,
    pub item: String,
    pub description: String,
    pub start_price: i128,
    pub end_time: u64,
    pub highest_bid: i128,
    pub highest_bidder: Option<Address>,
    pub settled: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Token,
    Count,
    Auction(u32),
}

const EVENT_TOPIC: Symbol = symbol_short!("auction");

#[contract]
pub struct AuctionContract;

#[contractimpl]
impl AuctionContract {
    pub fn initialize(env: Env, token: Address) -> Result<(), AuctionError> {
        if env.storage().instance().has(&DataKey::Token) {
            return Err(AuctionError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Count, &0u32);
        env.storage().instance().extend_ttl(100_000, 100_000);
        Ok(())
    }

    pub fn create_auction(
        env: Env,
        seller: Address,
        item: String,
        description: String,
        start_price: i128,
        duration: u64,
    ) -> Result<u32, AuctionError> {
        seller.require_auth();
        Self::require_initialized(&env)?;

        if start_price < 0 || duration == 0 {
            return Err(AuctionError::InvalidAmount);
        }

        let id: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let end_time = env.ledger().timestamp() + duration;

        let auction = AuctionData {
            id,
            seller: seller.clone(),
            item,
            description,
            start_price,
            end_time,
            highest_bid: 0,
            highest_bidder: None,
            settled: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Auction(id), &auction);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Auction(id), 100_000, 100_000);
        env.storage().instance().set(&DataKey::Count, &(id + 1));
        env.storage().instance().extend_ttl(100_000, 100_000);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("created"), id), seller);

        Ok(id)
    }

    pub fn bid(env: Env, id: u32, bidder: Address, amount: i128) -> Result<(), AuctionError> {
        bidder.require_auth();
        let token_addr = Self::require_initialized(&env)?;

        let mut auction = Self::load_auction(&env, id)?;

        if env.ledger().timestamp() >= auction.end_time {
            return Err(AuctionError::AuctionEnded);
        }
        if auction.settled {
            return Err(AuctionError::AlreadySettled);
        }
        if bidder == auction.seller {
            return Err(AuctionError::SelfBid);
        }
        if amount <= 0 {
            return Err(AuctionError::InvalidAmount);
        }

        let min_bid = if auction.highest_bidder.is_some() {
            auction.highest_bid + 1
        } else {
            auction.start_price
        };
        if amount < min_bid {
            return Err(AuctionError::BidTooLow);
        }

        let client = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();

        // Escrow the new bid
        client.transfer(&bidder, &contract_addr, &amount);

        // Refund previous highest bidder
        if let Some(prev) = auction.highest_bidder.clone() {
            let prev_amount = auction.highest_bid;
            if prev_amount > 0 {
                client.transfer(&contract_addr, &prev, &prev_amount);
            }
        }

        auction.highest_bid = amount;
        auction.highest_bidder = Some(bidder.clone());

        env.storage()
            .persistent()
            .set(&DataKey::Auction(id), &auction);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Auction(id), 100_000, 100_000);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("bid"), id), (bidder, amount));

        Ok(())
    }

    pub fn close(env: Env, id: u32) -> Result<(), AuctionError> {
        let token_addr = Self::require_initialized(&env)?;
        let mut auction = Self::load_auction(&env, id)?;

        if env.ledger().timestamp() < auction.end_time {
            return Err(AuctionError::NotEnded);
        }
        if auction.settled {
            return Err(AuctionError::AlreadySettled);
        }

        auction.settled = true;

        if let Some(winner) = auction.highest_bidder.clone() {
            let client = token::Client::new(&env, &token_addr);
            let contract_addr = env.current_contract_address();
            let payout = auction.highest_bid;
            if payout > 0 {
                client.transfer(&contract_addr, &auction.seller, &payout);
            }
            env.events().publish(
                (EVENT_TOPIC, symbol_short!("closed"), id),
                (winner, payout),
            );
        } else {
            env.events()
                .publish((EVENT_TOPIC, symbol_short!("closed"), id), ());
        }

        env.storage()
            .persistent()
            .set(&DataKey::Auction(id), &auction);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Auction(id), 100_000, 100_000);

        Ok(())
    }

    pub fn get_auction(env: Env, id: u32) -> Result<AuctionData, AuctionError> {
        Self::load_auction(&env, id)
    }

    pub fn list_auctions(env: Env) -> Vec<AuctionData> {
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let mut out = Vec::new(&env);
        for i in 0..count {
            if let Some(a) = env
                .storage()
                .persistent()
                .get::<DataKey, AuctionData>(&DataKey::Auction(i))
            {
                out.push_back(a);
            }
        }
        out
    }

    fn require_initialized(env: &Env) -> Result<Address, AuctionError> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(AuctionError::NotInitialized)
    }

    fn load_auction(env: &Env, id: u32) -> Result<AuctionData, AuctionError> {
        env.storage()
            .persistent()
            .get(&DataKey::Auction(id))
            .ok_or(AuctionError::AuctionNotFound)
    }
}

#[cfg(test)]
mod test;
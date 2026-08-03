#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, Env, Symbol, Vec,
};

#[contractclient(name = "ItemNftClient")]
pub trait ItemNftInterface {
    fn transfer(env: Env, from: Address, to: Address, token_id: u32);
    fn owner_of(env: Env, token_id: u32) -> Address;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FixedPriceError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ListingNotFound = 3,
    NotActive = 4,
    NotSeller = 5,
    NotNftOwner = 6,
    InvalidPrice = 7,
    SelfBuy = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub id: u32,
    pub seller: Address,
    pub token_id: u32,
    pub price: i128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    XlmToken,
    NftContract,
    Count,
    Listing(u32),
}

const EVENT_TOPIC: Symbol = symbol_short!("sale");

#[contract]
pub struct FixedPriceContract;

#[contractimpl]
impl FixedPriceContract {
    pub fn initialize(
        env: Env,
        xlm_token: Address,
        nft_contract: Address,
    ) -> Result<(), FixedPriceError> {
        if env.storage().instance().has(&DataKey::XlmToken) {
            return Err(FixedPriceError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage()
            .instance()
            .set(&DataKey::NftContract, &nft_contract);
        env.storage().instance().set(&DataKey::Count, &0u32);
        env.storage().instance().extend_ttl(100_000, 100_000);
        Ok(())
    }

    /// List NFT at fixed XLM price (stroops). Escrows NFT into this contract.
    pub fn list(
        env: Env,
        seller: Address,
        token_id: u32,
        price: i128,
    ) -> Result<u32, FixedPriceError> {
        seller.require_auth();
        let nft_addr = Self::require_nft(&env)?;
        if price <= 0 {
            return Err(FixedPriceError::InvalidPrice);
        }

        let nft = ItemNftClient::new(&env, &nft_addr);
        if nft.owner_of(&token_id) != seller {
            return Err(FixedPriceError::NotNftOwner);
        }

        let contract_addr = env.current_contract_address();
        nft.transfer(&seller, &contract_addr, &token_id);

        let id: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let listing = Listing {
            id,
            seller: seller.clone(),
            token_id,
            price,
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Listing(id), &listing);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Listing(id), 100_000, 100_000);
        env.storage().instance().set(&DataKey::Count, &(id + 1));
        env.storage().instance().extend_ttl(100_000, 100_000);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("listed"), id), (seller, token_id, price));

        Ok(id)
    }

    /// Buy: XLM → seller, NFT → buyer. Matches FixedPricePort.buy.
    pub fn buy(env: Env, listing_id: u32, buyer: Address) -> Result<u32, FixedPriceError> {
        buyer.require_auth();
        let xlm_addr = Self::require_xlm(&env)?;
        let nft_addr = Self::require_nft(&env)?;

        let mut listing = Self::load_listing(&env, listing_id)?;
        if !listing.active {
            return Err(FixedPriceError::NotActive);
        }
        if buyer == listing.seller {
            return Err(FixedPriceError::SelfBuy);
        }

        let contract_addr = env.current_contract_address();
        let xlm = token::Client::new(&env, &xlm_addr);
        xlm.transfer(&buyer, &listing.seller, &listing.price);

        let nft = ItemNftClient::new(&env, &nft_addr);
        nft.transfer(&contract_addr, &buyer, &listing.token_id);

        listing.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);

        let token_id = listing.token_id;
        env.events().publish(
            (EVENT_TOPIC, symbol_short!("sold"), listing_id),
            (buyer, token_id),
        );

        Ok(token_id)
    }

    pub fn cancel(env: Env, listing_id: u32, seller: Address) -> Result<(), FixedPriceError> {
        seller.require_auth();
        let nft_addr = Self::require_nft(&env)?;
        let mut listing = Self::load_listing(&env, listing_id)?;
        if !listing.active {
            return Err(FixedPriceError::NotActive);
        }
        if listing.seller != seller {
            return Err(FixedPriceError::NotSeller);
        }

        let contract_addr = env.current_contract_address();
        let nft = ItemNftClient::new(&env, &nft_addr);
        nft.transfer(&contract_addr, &seller, &listing.token_id);

        listing.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("cancel"), listing_id), seller);
        Ok(())
    }

    pub fn get_listing(env: Env, listing_id: u32) -> Result<Listing, FixedPriceError> {
        Self::load_listing(&env, listing_id)
    }

    pub fn list_active(env: Env) -> Vec<Listing> {
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let mut out = Vec::new(&env);
        for i in 0..count {
            if let Some(l) = env
                .storage()
                .persistent()
                .get::<DataKey, Listing>(&DataKey::Listing(i))
            {
                if l.active {
                    out.push_back(l);
                }
            }
        }
        out
    }

    fn require_xlm(env: &Env) -> Result<Address, FixedPriceError> {
        env.storage()
            .instance()
            .get(&DataKey::XlmToken)
            .ok_or(FixedPriceError::NotInitialized)
    }

    fn require_nft(env: &Env) -> Result<Address, FixedPriceError> {
        env.storage()
            .instance()
            .get(&DataKey::NftContract)
            .ok_or(FixedPriceError::NotInitialized)
    }

    fn load_listing(env: &Env, id: u32) -> Result<Listing, FixedPriceError> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(id))
            .ok_or(FixedPriceError::ListingNotFound)
    }
}

#[cfg(test)]
mod test;

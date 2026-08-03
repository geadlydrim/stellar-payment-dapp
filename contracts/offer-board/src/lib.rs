#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, Env, String, Symbol, Vec,
};

#[contractclient(name = "ItemNftClient")]
pub trait ItemNftInterface {
    fn transfer(env: Env, from: Address, to: Address, token_id: u32);
    fn owner_of(env: Env, token_id: u32) -> Address;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OfferBoardError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ListingNotFound = 3,
    OfferNotFound = 4,
    NotActive = 5,
    NotSeller = 6,
    NotBuyer = 7,
    NotNftOwner = 8,
    InvalidOffer = 9,
    SelfOffer = 10,
    OfferNotPending = 11,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OfferStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeListing {
    pub id: u32,
    pub seller: Address,
    pub token_id: u32,
    pub wants_hint: String,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeOffer {
    pub id: u32,
    pub listing_id: u32,
    pub buyer: Address,
    pub xlm: i128,
    pub offer_token_ids: Vec<u32>,
    pub status: OfferStatus,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    XlmToken,
    NftContract,
    ListingCount,
    OfferCount,
    Listing(u32),
    Offer(u32),
}

const EVENT_TOPIC: Symbol = symbol_short!("trade");

#[contract]
pub struct OfferBoardContract;

#[contractimpl]
impl OfferBoardContract {
    pub fn initialize(
        env: Env,
        xlm_token: Address,
        nft_contract: Address,
    ) -> Result<(), OfferBoardError> {
        if env.storage().instance().has(&DataKey::XlmToken) {
            return Err(OfferBoardError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage()
            .instance()
            .set(&DataKey::NftContract, &nft_contract);
        env.storage().instance().set(&DataKey::ListingCount, &0u32);
        env.storage().instance().set(&DataKey::OfferCount, &0u32);
        env.storage().instance().extend_ttl(100_000, 100_000);
        Ok(())
    }

    /// Open-to-offers listing. Escrows seller NFT.
    pub fn list_for_offers(
        env: Env,
        seller: Address,
        token_id: u32,
        wants_hint: String,
    ) -> Result<u32, OfferBoardError> {
        seller.require_auth();
        let nft_addr = Self::require_nft(&env)?;

        let nft = ItemNftClient::new(&env, &nft_addr);
        if nft.owner_of(&token_id) != seller {
            return Err(OfferBoardError::NotNftOwner);
        }

        let contract_addr = env.current_contract_address();
        nft.transfer(&seller, &contract_addr, &token_id);

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ListingCount)
            .unwrap_or(0);
        let listing = TradeListing {
            id,
            seller: seller.clone(),
            token_id,
            wants_hint,
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Listing(id), &listing);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Listing(id), 100_000, 100_000);
        env.storage()
            .instance()
            .set(&DataKey::ListingCount, &(id + 1));
        env.storage().instance().extend_ttl(100_000, 100_000);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("listed"), id), (seller, token_id));

        Ok(id)
    }

    /// Submit offer with XLM and/or other NFT token ids. Escrows offered assets.
    pub fn submit_offer(
        env: Env,
        listing_id: u32,
        buyer: Address,
        xlm: i128,
        offer_token_ids: Vec<u32>,
    ) -> Result<u32, OfferBoardError> {
        buyer.require_auth();
        let xlm_addr = Self::require_xlm(&env)?;
        let nft_addr = Self::require_nft(&env)?;

        let listing = Self::load_listing(&env, listing_id)?;
        if !listing.active {
            return Err(OfferBoardError::NotActive);
        }
        if buyer == listing.seller {
            return Err(OfferBoardError::SelfOffer);
        }
        if xlm < 0 {
            return Err(OfferBoardError::InvalidOffer);
        }
        if xlm == 0 && offer_token_ids.is_empty() {
            return Err(OfferBoardError::InvalidOffer);
        }

        let contract_addr = env.current_contract_address();
        let nft = ItemNftClient::new(&env, &nft_addr);

        // Validate NFT ownership before any escrow transfers
        for tid in offer_token_ids.iter() {
            if nft.owner_of(&tid) != buyer {
                return Err(OfferBoardError::NotNftOwner);
            }
        }

        if xlm > 0 {
            let xlm_client = token::Client::new(&env, &xlm_addr);
            xlm_client.transfer(&buyer, &contract_addr, &xlm);
        }

        for tid in offer_token_ids.iter() {
            nft.transfer(&buyer, &contract_addr, &tid);
        }

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::OfferCount)
            .unwrap_or(0);
        let offer = TradeOffer {
            id,
            listing_id,
            buyer: buyer.clone(),
            xlm,
            offer_token_ids: offer_token_ids.clone(),
            status: OfferStatus::Pending,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Offer(id), &offer);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Offer(id), 100_000, 100_000);
        env.storage()
            .instance()
            .set(&DataKey::OfferCount, &(id + 1));
        env.storage().instance().extend_ttl(100_000, 100_000);

        env.events().publish(
            (EVENT_TOPIC, symbol_short!("offer"), id),
            (listing_id, buyer),
        );

        Ok(id)
    }

    /// Accept: listed NFT → buyer; offered XLM/NFTs → seller; reject other pending.
    pub fn accept_offer(
        env: Env,
        offer_id: u32,
        seller: Address,
    ) -> Result<(), OfferBoardError> {
        seller.require_auth();
        let xlm_addr = Self::require_xlm(&env)?;
        let nft_addr = Self::require_nft(&env)?;

        let mut offer = Self::load_offer(&env, offer_id)?;
        if offer.status != OfferStatus::Pending {
            return Err(OfferBoardError::OfferNotPending);
        }

        let mut listing = Self::load_listing(&env, offer.listing_id)?;
        if !listing.active {
            return Err(OfferBoardError::NotActive);
        }
        if listing.seller != seller {
            return Err(OfferBoardError::NotSeller);
        }

        let contract_addr = env.current_contract_address();
        let nft = ItemNftClient::new(&env, &nft_addr);

        // Listed NFT → buyer
        nft.transfer(&contract_addr, &offer.buyer, &listing.token_id);

        // Offered XLM → seller
        if offer.xlm > 0 {
            let xlm_client = token::Client::new(&env, &xlm_addr);
            xlm_client.transfer(&contract_addr, &seller, &offer.xlm);
        }

        // Offered NFTs → seller
        for tid in offer.offer_token_ids.iter() {
            nft.transfer(&contract_addr, &seller, &tid);
        }

        offer.status = OfferStatus::Accepted;
        listing.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing.id), &listing);

        // Refund other pending offers on this listing
        Self::reject_other_pending(&env, listing.id, offer_id, &xlm_addr, &nft_addr)?;

        env.events().publish(
            (EVENT_TOPIC, symbol_short!("accept"), offer_id),
            listing.id,
        );
        Ok(())
    }

    pub fn reject_offer(
        env: Env,
        offer_id: u32,
        seller: Address,
    ) -> Result<(), OfferBoardError> {
        seller.require_auth();
        let xlm_addr = Self::require_xlm(&env)?;
        let nft_addr = Self::require_nft(&env)?;

        let offer = Self::load_offer(&env, offer_id)?;
        if offer.status != OfferStatus::Pending {
            return Err(OfferBoardError::OfferNotPending);
        }
        let listing = Self::load_listing(&env, offer.listing_id)?;
        if listing.seller != seller {
            return Err(OfferBoardError::NotSeller);
        }

        Self::refund_offer(&env, &offer, &xlm_addr, &nft_addr)?;

        let mut offer = offer;
        offer.status = OfferStatus::Rejected;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("reject"), offer_id), listing.id);
        Ok(())
    }

    pub fn cancel_listing(
        env: Env,
        listing_id: u32,
        seller: Address,
    ) -> Result<(), OfferBoardError> {
        seller.require_auth();
        let xlm_addr = Self::require_xlm(&env)?;
        let nft_addr = Self::require_nft(&env)?;

        let mut listing = Self::load_listing(&env, listing_id)?;
        if !listing.active {
            return Err(OfferBoardError::NotActive);
        }
        if listing.seller != seller {
            return Err(OfferBoardError::NotSeller);
        }

        let contract_addr = env.current_contract_address();
        let nft = ItemNftClient::new(&env, &nft_addr);
        nft.transfer(&contract_addr, &seller, &listing.token_id);

        listing.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);

        // Refund all pending offers
        Self::reject_other_pending(&env, listing_id, u32::MAX, &xlm_addr, &nft_addr)?;

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("cancel"), listing_id), seller);
        Ok(())
    }

    pub fn get_listing(env: Env, listing_id: u32) -> Result<TradeListing, OfferBoardError> {
        Self::load_listing(&env, listing_id)
    }

    pub fn get_offer(env: Env, offer_id: u32) -> Result<TradeOffer, OfferBoardError> {
        Self::load_offer(&env, offer_id)
    }

    pub fn list_active(env: Env) -> Vec<TradeListing> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ListingCount)
            .unwrap_or(0);
        let mut out = Vec::new(&env);
        for i in 0..count {
            if let Some(l) = env
                .storage()
                .persistent()
                .get::<DataKey, TradeListing>(&DataKey::Listing(i))
            {
                if l.active {
                    out.push_back(l);
                }
            }
        }
        out
    }

    pub fn list_offers(env: Env, listing_id: u32) -> Vec<TradeOffer> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::OfferCount)
            .unwrap_or(0);
        let mut out = Vec::new(&env);
        for i in 0..count {
            if let Some(o) = env
                .storage()
                .persistent()
                .get::<DataKey, TradeOffer>(&DataKey::Offer(i))
            {
                if o.listing_id == listing_id {
                    out.push_back(o);
                }
            }
        }
        out
    }

    fn reject_other_pending(
        env: &Env,
        listing_id: u32,
        keep_offer_id: u32,
        xlm_addr: &Address,
        nft_addr: &Address,
    ) -> Result<(), OfferBoardError> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::OfferCount)
            .unwrap_or(0);
        for i in 0..count {
            if i == keep_offer_id {
                continue;
            }
            if let Some(mut o) = env
                .storage()
                .persistent()
                .get::<DataKey, TradeOffer>(&DataKey::Offer(i))
            {
                if o.listing_id == listing_id && o.status == OfferStatus::Pending {
                    Self::refund_offer(env, &o, xlm_addr, nft_addr)?;
                    o.status = OfferStatus::Rejected;
                    env.storage().persistent().set(&DataKey::Offer(i), &o);
                }
            }
        }
        Ok(())
    }

    fn refund_offer(
        env: &Env,
        offer: &TradeOffer,
        xlm_addr: &Address,
        nft_addr: &Address,
    ) -> Result<(), OfferBoardError> {
        let contract_addr = env.current_contract_address();
        if offer.xlm > 0 {
            let xlm_client = token::Client::new(env, xlm_addr);
            xlm_client.transfer(&contract_addr, &offer.buyer, &offer.xlm);
        }
        let nft = ItemNftClient::new(env, nft_addr);
        for tid in offer.offer_token_ids.iter() {
            nft.transfer(&contract_addr, &offer.buyer, &tid);
        }
        Ok(())
    }

    fn require_xlm(env: &Env) -> Result<Address, OfferBoardError> {
        env.storage()
            .instance()
            .get(&DataKey::XlmToken)
            .ok_or(OfferBoardError::NotInitialized)
    }

    fn require_nft(env: &Env) -> Result<Address, OfferBoardError> {
        env.storage()
            .instance()
            .get(&DataKey::NftContract)
            .ok_or(OfferBoardError::NotInitialized)
    }

    fn load_listing(env: &Env, id: u32) -> Result<TradeListing, OfferBoardError> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(id))
            .ok_or(OfferBoardError::ListingNotFound)
    }

    fn load_offer(env: &Env, id: u32) -> Result<TradeOffer, OfferBoardError> {
        env.storage()
            .persistent()
            .get(&DataKey::Offer(id))
            .ok_or(OfferBoardError::OfferNotFound)
    }
}

#[cfg(test)]
mod test;

#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
    String, Symbol,
};

/// Client interface for marketplace contracts (auction / fixed-price / offer-board).
#[contractclient(name = "ItemNftClient")]
pub trait ItemNftInterface {
    fn transfer(env: Env, from: Address, to: Address, token_id: u32);
    fn owner_of(env: Env, token_id: u32) -> Address;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum NftError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAdmin = 3,
    NotMinter = 4,
    NotOwner = 5,
    TokenNotFound = 6,
    InvalidToken = 7,
    ItemAlreadyMinted = 8,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NextId,
    Minter(Address),
    Owner(u32),
    ItemId(u32),
    /// Live token for a Registry `item_id`. Cleared on burn so re-export can mint again.
    TokenByItem(String),
}

const EVENT_TOPIC: Symbol = symbol_short!("item_nft");

#[contract]
pub struct ItemNftContract;

#[contractimpl]
impl ItemNftContract {
    /// One-time setup. Admin is always a minter. `set_minter` is optional for mint-to-other.
    pub fn initialize(env: Env, admin: Address) -> Result<(), NftError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(NftError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &0u32);
        env.storage().instance().extend_ttl(100_000, 100_000);
        Ok(())
    }

    /// Admin grants or revokes mint-to-other authority. Not required for player self-mint.
    pub fn set_minter(
        env: Env,
        admin: Address,
        minter: Address,
        authorized: bool,
    ) -> Result<(), NftError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        env.storage()
            .instance()
            .set(&DataKey::Minter(minter), &authorized);
        env.storage().instance().extend_ttl(100_000, 100_000);
        Ok(())
    }

    /// Mint a new NFT to `to`. Returns on-chain `token_id` (stringified for TokenId in ports).
    /// `item_id` is the Registry item id string for NftBridge import mapping.
    /// Self-mint (`minter == to`) is allowed for any signer; mint-to-other requires
    /// admin or `set_minter`. A given `item_id` may have only one live token.
    pub fn mint(
        env: Env,
        minter: Address,
        to: Address,
        item_id: String,
    ) -> Result<u32, NftError> {
        minter.require_auth();
        Self::require_initialized(&env)?;
        if item_id.is_empty() {
            return Err(NftError::InvalidToken);
        }
        if minter != to && !Self::is_minter_inner(&env, &minter) {
            return Err(NftError::NotMinter);
        }

        let by_item = DataKey::TokenByItem(item_id.clone());
        if env.storage().persistent().has(&by_item) {
            return Err(NftError::ItemAlreadyMinted);
        }

        let token_id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);
        env.storage()
            .persistent()
            .set(&DataKey::ItemId(token_id), &item_id);
        env.storage().persistent().set(&by_item, &token_id);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Owner(token_id), 100_000, 100_000);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::ItemId(token_id), 100_000, 100_000);
        env.storage()
            .persistent()
            .extend_ttl(&by_item, 100_000, 100_000);

        env.storage().instance().set(&DataKey::NextId, &(token_id + 1));
        env.storage().instance().extend_ttl(100_000, 100_000);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("mint"), token_id), (to, item_id));

        Ok(token_id)
    }

    /// Burn / redeem NFT (NftBridge import). Caller must own the token.
    pub fn burn(env: Env, from: Address, token_id: u32) -> Result<(), NftError> {
        from.require_auth();
        let owner = Self::load_owner(&env, token_id)?;
        if owner != from {
            return Err(NftError::NotOwner);
        }

        let item_id: String = env
            .storage()
            .persistent()
            .get(&DataKey::ItemId(token_id))
            .unwrap_or_else(|| String::from_str(&env, ""));

        env.storage().persistent().remove(&DataKey::Owner(token_id));
        env.storage().persistent().remove(&DataKey::ItemId(token_id));
        env.storage()
            .persistent()
            .remove(&DataKey::TokenByItem(item_id.clone()));

        env.events().publish(
            (EVENT_TOPIC, symbol_short!("burn"), token_id),
            (from, item_id),
        );
        Ok(())
    }

    /// Transfer NFT. `from` must own the token and authorize.
    /// Marketplace contracts call this with `from` = themselves when settling escrow.
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: u32,
    ) -> Result<(), NftError> {
        from.require_auth();
        let owner = Self::load_owner(&env, token_id)?;
        if owner != from {
            return Err(NftError::NotOwner);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Owner(token_id), 100_000, 100_000);

        env.events()
            .publish((EVENT_TOPIC, symbol_short!("xfer"), token_id), (from, to));
        Ok(())
    }

    pub fn owner_of(env: Env, token_id: u32) -> Result<Address, NftError> {
        Self::load_owner(&env, token_id)
    }

    pub fn get_item_id(env: Env, token_id: u32) -> Result<String, NftError> {
        if !env.storage().persistent().has(&DataKey::Owner(token_id)) {
            return Err(NftError::TokenNotFound);
        }
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::ItemId(token_id))
            .unwrap_or_else(|| String::from_str(&env, "")))
    }

    pub fn exists(env: Env, token_id: u32) -> bool {
        env.storage().persistent().has(&DataKey::Owner(token_id))
    }

    pub fn is_minter(env: Env, address: Address) -> bool {
        Self::is_minter_inner(&env, &address)
    }

    fn require_initialized(env: &Env) -> Result<(), NftError> {
        if env.storage().instance().has(&DataKey::Admin) {
            Ok(())
        } else {
            Err(NftError::NotInitialized)
        }
    }

    fn require_admin(env: &Env, admin: &Address) -> Result<(), NftError> {
        let stored: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(NftError::NotInitialized)?;
        if &stored != admin {
            return Err(NftError::NotAdmin);
        }
        Ok(())
    }

    fn is_minter_inner(env: &Env, address: &Address) -> bool {
        if let Some(admin) = env.storage().instance().get::<DataKey, Address>(&DataKey::Admin) {
            if &admin == address {
                return true;
            }
        }
        env.storage()
            .instance()
            .get(&DataKey::Minter(address.clone()))
            .unwrap_or(false)
    }

    fn load_owner(env: &Env, token_id: u32) -> Result<Address, NftError> {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .ok_or(NftError::TokenNotFound)
    }
}

#[cfg(test)]
mod test;

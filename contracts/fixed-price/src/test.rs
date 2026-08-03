#![cfg(test)]

use super::*;
use item_nft::{ItemNftContract, ItemNftContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let nft_id = env.register(ItemNftContract, ());
    ItemNftContractClient::new(&env, &nft_id).initialize(&admin);

    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let xlm = sac.address();

    let market_id = env.register(FixedPriceContract, ());
    FixedPriceContractClient::new(&env, &market_id).initialize(&xlm, &nft_id);

    (env, market_id, nft_id, xlm, admin)
}

#[test]
fn list_buy_transfers_nft_and_xlm() {
    let (env, market_id, nft_id, xlm, admin) = setup();
    let market = FixedPriceContractClient::new(&env, &market_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token = token::Client::new(&env, &xlm);
    let token_admin = token::StellarAssetClient::new(&env, &xlm);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    token_admin.mint(&buyer, &100_000_000);

    let token_id = nft.mint(&admin, &seller, &String::from_str(&env, "item-1"));
    let listing_id = market.list(&seller, &token_id, &25_000_000);
    assert_eq!(nft.owner_of(&token_id), market_id);

    let got = market.buy(&listing_id, &buyer);
    assert_eq!(got, token_id);
    assert_eq!(nft.owner_of(&token_id), buyer);
    assert_eq!(token.balance(&seller), 25_000_000);
    assert!(!market.get_listing(&listing_id).active);
}

#[test]
fn cancel_returns_nft() {
    let (env, market_id, nft_id, _xlm, admin) = setup();
    let market = FixedPriceContractClient::new(&env, &market_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);

    let seller = Address::generate(&env);
    let token_id = nft.mint(&admin, &seller, &String::from_str(&env, "item-2"));
    let listing_id = market.list(&seller, &token_id, &10_000_000);
    market.cancel(&listing_id, &seller);
    assert_eq!(nft.owner_of(&token_id), seller);
    assert!(!market.get_listing(&listing_id).active);
}

#[test]
fn list_active_filters() {
    let (env, market_id, nft_id, _xlm, admin) = setup();
    let market = FixedPriceContractClient::new(&env, &market_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let seller = Address::generate(&env);

    let t0 = nft.mint(&admin, &seller, &String::from_str(&env, "a"));
    let t1 = nft.mint(&admin, &seller, &String::from_str(&env, "b"));
    let l0 = market.list(&seller, &t0, &1);
    let l1 = market.list(&seller, &t1, &2);
    market.cancel(&l0, &seller);

    let active = market.list_active();
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, l1);
}

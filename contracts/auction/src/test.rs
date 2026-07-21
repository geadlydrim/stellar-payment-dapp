#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, String};

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AuctionContract, ());
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();

    let client = AuctionContractClient::new(&env, &contract_id);
    client.initialize(&token_address);

    (env, contract_id, token_address, token_admin)
}

#[test]
fn create_and_bid_and_close() {
    let (env, contract_id, token_address, _admin) = setup();
    let client = AuctionContractClient::new(&env, &contract_id);
    let token = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    let seller = Address::generate(&env);
    let bidder1 = Address::generate(&env);
    let bidder2 = Address::generate(&env);

    token_admin_client.mint(&bidder1, &1_000_000_000);
    token_admin_client.mint(&bidder2, &1_000_000_000);

    let id = client.create_auction(
        &seller,
        &String::from_str(&env, "Vintage Watch"),
        &String::from_str(&env, "A classic piece"),
        &10_000_000, // 1 XLM
        &100,
    );
    assert_eq!(id, 0);

    client.bid(&id, &bidder1, &15_000_000);
    let a = client.get_auction(&id);
    assert_eq!(a.highest_bid, 15_000_000);
    assert_eq!(a.highest_bidder, Some(bidder1.clone()));
    assert_eq!(token.balance(&contract_id), 15_000_000);

    client.bid(&id, &bidder2, &20_000_000);
    let a = client.get_auction(&id);
    assert_eq!(a.highest_bid, 20_000_000);
    assert_eq!(a.highest_bidder, Some(bidder2.clone()));
    // bidder1 refunded, only bidder2's bid held
    assert_eq!(token.balance(&contract_id), 20_000_000);
    assert_eq!(token.balance(&bidder1), 1_000_000_000);

    env.ledger().with_mut(|l| l.timestamp = 200);
    client.close(&id);

    let a = client.get_auction(&id);
    assert!(a.settled);
    assert_eq!(token.balance(&seller), 20_000_000);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn bid_too_low_fails() {
    let (env, contract_id, token_address, _) = setup();
    let client = AuctionContractClient::new(&env, &contract_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &1_000_000_000);

    let id = client.create_auction(
        &seller,
        &String::from_str(&env, "Item"),
        &String::from_str(&env, "Desc"),
        &10_000_000,
        &100,
    );

    let result = client.try_bid(&id, &bidder, &5_000_000);
    assert_eq!(result, Err(Ok(AuctionError::BidTooLow)));
}

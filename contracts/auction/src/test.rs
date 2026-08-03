#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, String};

// Path-dependent item-nft for inter-contract tests
use item_nft::ItemNftContract;
use item_nft::ItemNftContractClient;

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

fn setup_nft(env: &Env, admin: &Address) -> Address {
    let nft_id = env.register(ItemNftContract, ());
    let nft = ItemNftContractClient::new(env, &nft_id);
    nft.initialize(admin);
    nft_id
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
    assert!(a.nft_contract.is_none());
    assert!(a.token_id.is_none());

    client.bid(&id, &bidder2, &20_000_000);
    let a = client.get_auction(&id);
    assert_eq!(a.highest_bid, 20_000_000);
    assert_eq!(a.highest_bidder, Some(bidder2.clone()));
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

#[test]
fn nft_auction_settles_to_winner() {
    let (env, contract_id, token_address, _) = setup();
    let auction = AuctionContractClient::new(&env, &contract_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    let admin = Address::generate(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &1_000_000_000);

    let nft_id = setup_nft(&env, &admin);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token_id = nft.mint(&admin, &seller, &String::from_str(&env, "item-sword-1"));

    let auction_id = auction.create_nft_auction(
        &seller,
        &nft_id,
        &token_id,
        &10_000_000,
        &100,
    );
    assert_eq!(nft.owner_of(&token_id), contract_id);

    let a = auction.get_auction(&auction_id);
    assert_eq!(a.token_id, Some(token_id));
    assert_eq!(a.nft_contract, Some(nft_id.clone()));

    auction.bid(&auction_id, &bidder, &15_000_000);
    env.ledger().with_mut(|l| l.timestamp = 200);
    auction.close(&auction_id);

    assert_eq!(nft.owner_of(&token_id), bidder);
    let token = token::Client::new(&env, &token_address);
    assert_eq!(token.balance(&seller), 15_000_000);
}

#[test]
fn nft_auction_no_bids_returns_nft() {
    let (env, contract_id, _token_address, _) = setup();
    let auction = AuctionContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let seller = Address::generate(&env);
    let nft_id = setup_nft(&env, &admin);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token_id = nft.mint(&admin, &seller, &String::from_str(&env, "item-1"));

    let auction_id =
        auction.create_nft_auction(&seller, &nft_id, &token_id, &10_000_000, &50);
    env.ledger().with_mut(|l| l.timestamp = 100);
    auction.close(&auction_id);

    assert_eq!(nft.owner_of(&token_id), seller);
}

#![cfg(test)]

use super::*;
use item_nft::{ItemNftContract, ItemNftContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let nft_id = env.register(ItemNftContract, ());
    ItemNftContractClient::new(&env, &nft_id).initialize(&admin);

    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let xlm = sac.address();

    let board_id = env.register(OfferBoardContract, ());
    OfferBoardContractClient::new(&env, &board_id).initialize(&xlm, &nft_id);

    (env, board_id, nft_id, xlm, admin)
}

#[test]
fn accept_xlm_offer() {
    let (env, board_id, nft_id, xlm, admin) = setup();
    let board = OfferBoardContractClient::new(&env, &board_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token = token::Client::new(&env, &xlm);
    let token_admin = token::StellarAssetClient::new(&env, &xlm);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    token_admin.mint(&buyer, &50_000_000);

    let listed = nft.mint(&admin, &seller, &String::from_str(&env, "listed"));
    let listing_id = board.list_for_offers(
        &seller,
        &listed,
        &String::from_str(&env, "want XLM"),
    );

    let empty = Vec::new(&env);
    let offer_id = board.submit_offer(&listing_id, &buyer, &30_000_000, &empty);
    board.accept_offer(&offer_id, &seller);

    assert_eq!(nft.owner_of(&listed), buyer);
    assert_eq!(token.balance(&seller), 30_000_000);
    assert!(!board.get_listing(&listing_id).active);
    assert_eq!(board.get_offer(&offer_id).status, OfferStatus::Accepted);
}

#[test]
fn accept_nft_plus_xlm_offer() {
    let (env, board_id, nft_id, xlm, admin) = setup();
    let board = OfferBoardContractClient::new(&env, &board_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token_admin = token::StellarAssetClient::new(&env, &xlm);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    token_admin.mint(&buyer, &20_000_000);

    let listed = nft.mint(&admin, &seller, &String::from_str(&env, "listed"));
    let offered = nft.mint(&admin, &buyer, &String::from_str(&env, "offered"));

    let listing_id =
        board.list_for_offers(&seller, &listed, &String::from_str(&env, "swap"));
    let mut offer_tokens = Vec::new(&env);
    offer_tokens.push_back(offered);
    let offer_id = board.submit_offer(&listing_id, &buyer, &5_000_000, &offer_tokens);
    board.accept_offer(&offer_id, &seller);

    assert_eq!(nft.owner_of(&listed), buyer);
    assert_eq!(nft.owner_of(&offered), seller);
}

#[test]
fn reject_refunds_escrow() {
    let (env, board_id, nft_id, xlm, admin) = setup();
    let board = OfferBoardContractClient::new(&env, &board_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token = token::Client::new(&env, &xlm);
    let token_admin = token::StellarAssetClient::new(&env, &xlm);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    token_admin.mint(&buyer, &40_000_000);

    let listed = nft.mint(&admin, &seller, &String::from_str(&env, "listed"));
    let listing_id =
        board.list_for_offers(&seller, &listed, &String::from_str(&env, ""));
    let empty = Vec::new(&env);
    let offer_id = board.submit_offer(&listing_id, &buyer, &40_000_000, &empty);
    board.reject_offer(&offer_id, &seller);

    assert_eq!(token.balance(&buyer), 40_000_000);
    assert_eq!(board.get_offer(&offer_id).status, OfferStatus::Rejected);
    assert!(board.get_listing(&listing_id).active);
}

#[test]
fn cancel_listing_refunds_pending() {
    let (env, board_id, nft_id, xlm, admin) = setup();
    let board = OfferBoardContractClient::new(&env, &board_id);
    let nft = ItemNftContractClient::new(&env, &nft_id);
    let token = token::Client::new(&env, &xlm);
    let token_admin = token::StellarAssetClient::new(&env, &xlm);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    token_admin.mint(&buyer, &10_000_000);

    let listed = nft.mint(&admin, &seller, &String::from_str(&env, "listed"));
    let listing_id =
        board.list_for_offers(&seller, &listed, &String::from_str(&env, ""));
    let empty = Vec::new(&env);
    let offer_id = board.submit_offer(&listing_id, &buyer, &10_000_000, &empty);

    board.cancel_listing(&listing_id, &seller);
    assert_eq!(nft.owner_of(&listed), seller);
    assert_eq!(token.balance(&buyer), 10_000_000);
    assert_eq!(board.get_offer(&offer_id).status, OfferStatus::Rejected);
}

#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ItemNftContract, ());
    let admin = Address::generate(&env);
    let client = ItemNftContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, contract_id, admin)
}

#[test]
fn mint_transfer_burn() {
    let (env, contract_id, admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let buyer = Address::generate(&env);

    let item_id = String::from_str(&env, "item-sword-1");
    let token_id = client.mint(&admin, &owner, &item_id);
    assert_eq!(token_id, 0);
    assert_eq!(client.owner_of(&token_id), owner);
    assert_eq!(client.get_item_id(&token_id), item_id);
    assert!(client.exists(&token_id));

    client.transfer(&owner, &buyer, &token_id);
    assert_eq!(client.owner_of(&token_id), buyer);

    client.burn(&buyer, &token_id);
    assert!(!client.exists(&token_id));
}

#[test]
fn only_minter_can_mint() {
    let (env, contract_id, admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let stranger = Address::generate(&env);
    let to = Address::generate(&env);

    let result = client.try_mint(
        &stranger,
        &to,
        &String::from_str(&env, "item-1"),
    );
    assert_eq!(result, Err(Ok(NftError::NotMinter)));

    client.set_minter(&admin, &stranger, &true);
    let id = client.mint(&stranger, &to, &String::from_str(&env, "item-1"));
    assert_eq!(id, 0);
    assert!(client.is_minter(&stranger));
}

#[test]
fn stranger_mints_to_self_without_set_minter() {
    let (env, contract_id, _admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let stranger = Address::generate(&env);

    assert!(!client.is_minter(&stranger));
    let item_id = String::from_str(&env, "item-self-1");
    let token_id = client.mint(&stranger, &stranger, &item_id);
    assert_eq!(token_id, 0);
    assert_eq!(client.owner_of(&token_id), stranger);
    assert_eq!(client.get_item_id(&token_id), item_id);
    assert!(!client.is_minter(&stranger));
}

#[test]
fn duplicate_live_item_id_rejected() {
    let (env, contract_id, _admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let stranger = Address::generate(&env);
    let item_id = String::from_str(&env, "item-dup");

    client.mint(&stranger, &stranger, &item_id);
    let result = client.try_mint(&stranger, &stranger, &item_id);
    assert_eq!(result, Err(Ok(NftError::ItemAlreadyMinted)));
}

#[test]
fn burn_then_remint_same_item_id() {
    let (env, contract_id, _admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let stranger = Address::generate(&env);
    let item_id = String::from_str(&env, "item-reexport");

    let first = client.mint(&stranger, &stranger, &item_id);
    assert_eq!(first, 0);
    client.burn(&stranger, &first);
    assert!(!client.exists(&first));

    let second = client.mint(&stranger, &stranger, &item_id);
    assert_eq!(second, 1);
    assert_eq!(client.owner_of(&second), stranger);
    assert_eq!(client.get_item_id(&second), item_id);
}

#[test]
fn empty_item_id_rejected() {
    let (env, contract_id, admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let result = client.try_mint(&admin, &owner, &String::from_str(&env, ""));
    assert_eq!(result, Err(Ok(NftError::InvalidToken)));
}

#[test]
fn transfer_requires_owner() {
    let (env, contract_id, admin) = setup();
    let client = ItemNftContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let other = Address::generate(&env);
    let to = Address::generate(&env);

    let token_id = client.mint(&admin, &owner, &String::from_str(&env, "item-1"));
    let result = client.try_transfer(&other, &to, &token_id);
    assert_eq!(result, Err(Ok(NftError::NotOwner)));
}

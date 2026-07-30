import type { ItemId, ItemState } from './types';

export class RegistryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
  }
}

export class ItemNotFoundError extends RegistryError {
  constructor(id: ItemId) {
    super('ITEM_NOT_FOUND', `Item not found: ${id}`);
    this.name = 'ItemNotFoundError';
  }
}

export class OwnerMismatchError extends RegistryError {
  constructor(id: ItemId, ownerId: string) {
    super(
      'OWNER_MISMATCH',
      `Owner mismatch for item ${id}: expected owner ${ownerId}`
    );
    this.name = 'OwnerMismatchError';
  }
}

export class IllegalTransitionError extends RegistryError {
  constructor(id: ItemId, from: ItemState, to: ItemState, reason?: string) {
    const detail = reason ? ` (${reason})` : '';
    super(
      'ILLEGAL_TRANSITION',
      `Illegal transition for item ${id}: ${from} → ${to}${detail}`
    );
    this.name = 'IllegalTransitionError';
  }
}

export class InvalidArgumentError extends RegistryError {
  constructor(message: string) {
    super('INVALID_ARGUMENT', message);
    this.name = 'InvalidArgumentError';
  }
}

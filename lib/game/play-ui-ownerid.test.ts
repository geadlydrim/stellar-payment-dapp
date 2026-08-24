import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function src(rel: string): string {
  return readFileSync(rel, 'utf8');
}

describe('play UI injects ownerId (identity 02)', () => {
  it('PlayApp uses PLAYER_OWNER_ID only as the default prop', () => {
    const text = src('components/game/PlayApp.tsx');
    assert.match(text, /ownerId\s*=\s*PLAYER_OWNER_ID/);
    assert.doesNotMatch(text, /listVisibleInventory\(\s*PLAYER_OWNER_ID/);
    assert.doesNotMatch(text, /spinAndAdd\(\s*(undefined|PLAYER_OWNER_ID)/);
    assert.doesNotMatch(text, /exportToNft\([^)]*PLAYER_OWNER_ID/);
    assert.doesNotMatch(text, /importFromNft\([^)]*PLAYER_OWNER_ID/);
    assert.match(text, /listVisibleInventory\(\s*ownerId\s*\)/);
  });

  it('SpinLottery never mentions PLAYER_OWNER_ID and passes ownerId to spinAndAdd', () => {
    const text = src('components/game/SpinLottery.tsx');
    assert.doesNotMatch(text, /PLAYER_OWNER_ID/);
    assert.match(text, /spinAndAdd\(\s*ownerId/);
    assert.doesNotMatch(text, /spinAndAdd\(\s*undefined/);
  });

  it('ItemDetailModal export/import use the ownerId prop', () => {
    const text = src('components/game/ItemDetailModal.tsx');
    assert.doesNotMatch(text, /PLAYER_OWNER_ID/);
    assert.match(text, /exportToNft\(\s*item\.id\s*,\s*ownerId/);
    assert.match(text, /importFromNft\(\s*item\.tokenId\s*,\s*ownerId/);
    assert.match(text, /data-hook="export-to-nft-confirm"/);
    assert.match(text, /data-hook="import-from-nft"/);
  });
});

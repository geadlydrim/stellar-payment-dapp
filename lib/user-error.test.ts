import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  looksLikeChainDump,
  parseContractErrorCode,
  toUserMessage,
} from '@/lib/user-error';
import { auctionCloseFailureToPortError } from '@/lib/adapters/stellar/contract-error';

describe('toUserMessage', () => {
  it('never echoes HostError dumps', () => {
    const dump =
      'HostError: Error(Contract, #7) Event log (newest first): 0: [Diagnostic Event] fn_call close';
    assert.equal(looksLikeChainDump(dump), true);
    assert.equal(parseContractErrorCode(dump), 7);
    const msg = toUserMessage(new Error(dump), { method: 'close' });
    assert.doesNotMatch(msg, /HostError|Event log|fn_call|#7/i);
    assert.match(msg, /still running/i);
  });

  it('maps wallet cancel and timeouts', () => {
    assert.match(
      toUserMessage(new Error('User declined access')),
      /cancelled/i
    );
    assert.match(toUserMessage(new Error('RPC timeout')), /timed out/i);
  });

  it('keeps short PortError copy', () => {
    assert.equal(
      toUserMessage(new Error("You can't buy your own listing.")),
      "You can't buy your own listing."
    );
  });
});

describe('auctionCloseFailureToPortError stays player-facing', () => {
  it('does not include diagnostic log', () => {
    const err = auctionCloseFailureToPortError(
      new Error(
        'HostError: Error(Contract, #7) ... fn_call ... close], data:2'
      )
    );
    assert.doesNotMatch(err.message, /HostError|data:2/i);
  });
});

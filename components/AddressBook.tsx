'use client';

import { useEffect, useState } from 'react';
import { getEntries, saveEntry, deleteEntry, type AddressBookEntry } from '@/lib/addressBook';

function shortAddr(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function AddressBook({
  onPick,
  lastSentTo,
}: {
  recipient: string;
  onPick: (address: string) => void;
  lastSentTo?: string;
}) {
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [dismissed, setDismissed] = useState('');
  const [savePromptLabel, setSavePromptLabel] = useState('');

  useEffect(() => {
    setEntries(getEntries());
  }, []);

  const handleAdd = () => {
    if (!newAddress.trim() || !newLabel.trim()) return;
    setEntries(saveEntry({ address: newAddress.trim(), label: newLabel.trim() }));
    setNewAddress('');
    setNewLabel('');
    setAdding(false);
  };

  const handleDelete = (address: string) => {
    setEntries(deleteEntry(address));
  };

  const handleSavePrompt = () => {
    if (!lastSentTo) return;
    setEntries(saveEntry({ address: lastSentTo, label: savePromptLabel.trim() || 'Friend' }));
    setSavePromptLabel('');
  };

  const showSavePrompt =
    !!lastSentTo && lastSentTo !== dismissed && !entries.some((e) => e.address === lastSentTo);

  return (
    <div className="mb-4">
      {(entries.length > 0 || adding) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {entries.map((e) => (
            <span
              key={e.address}
              className="inline-flex items-center gap-1.5 bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-full py-1 px-1.5 pl-3 text-[12px]"
            >
              <button
                onClick={() => onPick(e.address)}
                className="border-none bg-transparent cursor-pointer text-[var(--qf-text-1)] font-medium"
              >
                {e.label} <span className="text-[var(--qf-text-4)] font-mono">{shortAddr(e.address)}</span>
              </button>
              <button
                onClick={() => handleDelete(e.address)}
                className="border-none bg-transparent cursor-pointer text-[var(--qf-text-4)] hover:text-[#EF4444] w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                title="Remove"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="w-[100px] box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-lg py-1.5 px-2.5 text-[12px] text-[var(--qf-text-1)] placeholder-[var(--qf-text-4)] focus:outline-none"
          />
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="G…"
            className="flex-1 min-w-[140px] box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-lg py-1.5 px-2.5 text-[12px] font-mono text-[var(--qf-text-1)] placeholder-[var(--qf-text-4)] focus:outline-none"
          />
          <button
            onClick={handleAdd}
            className="border-none cursor-pointer bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] text-[12px] font-medium py-1.5 px-3 rounded-lg"
          >
            Save
          </button>
          <button
            onClick={() => setAdding(false)}
            className="border-none bg-transparent cursor-pointer text-[var(--qf-text-3)] text-[12px]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[12px] text-[var(--qf-text-3)] cursor-pointer underline decoration-dotted"
        >
          + Save an address
        </button>
      )}

      {showSavePrompt && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 bg-[var(--qf-card-bg-soft)] border border-[var(--qf-card-border-soft)] rounded-xl py-2 px-3">
          <span className="text-[12px] text-[var(--qf-text-2)]">
            Save {shortAddr(lastSentTo!)} to your address book?
          </span>
          <input
            type="text"
            value={savePromptLabel}
            onChange={(e) => setSavePromptLabel(e.target.value)}
            placeholder="Label"
            className="w-[90px] box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-lg py-1 px-2 text-[12px] text-[var(--qf-text-1)] placeholder-[var(--qf-text-4)] focus:outline-none"
          />
          <button
            onClick={handleSavePrompt}
            className="border-none cursor-pointer bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] text-[12px] font-medium py-1 px-2.5 rounded-lg"
          >
            Save
          </button>
          <button
            onClick={() => setDismissed(lastSentTo!)}
            className="border-none bg-transparent cursor-pointer text-[var(--qf-text-4)] text-[12px]"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

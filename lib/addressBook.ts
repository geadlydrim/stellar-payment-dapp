export interface AddressBookEntry {
  address: string;
  label: string;
}

const STORAGE_KEY = 'driftpay:addressBook';

export function getEntries(): AddressBookEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry: AddressBookEntry): AddressBookEntry[] {
  const entries = getEntries().filter((e) => e.address !== entry.address);
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

export function deleteEntry(address: string): AddressBookEntry[] {
  const entries = getEntries().filter((e) => e.address !== address);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

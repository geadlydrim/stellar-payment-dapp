'use client';

import { MemoryItemRegistry, isListable, type Item } from '@/lib/registry';
import type { ItemRegistry } from '@/lib/registry';

/** Resolve display metadata for a tokenId from the shared registry. */
export function itemForToken(
  registry: ItemRegistry,
  tokenId: string
): Item | undefined {
  if (registry instanceof MemoryItemRegistry) {
    return registry.listAll().find((i) => i.tokenId === tokenId);
  }
  return undefined;
}

export function listableForOwner(
  registry: ItemRegistry,
  ownerId: string
): Item[] {
  if (!ownerId) return [];
  return registry.listByOwner(ownerId).filter(isListable);
}

export function shortId(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function formatEnd(endTime: number): string {
  const ms = endTime - Date.now();
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

'use client';

import { useEffect, useState } from 'react';
import type { Tier, WeaponType } from '@/lib/game';
import {
  charmIconDataUrl,
  weaponIconDataUrl,
} from './pixel/sprites';

interface WeaponPixelIconProps {
  weaponType: WeaponType;
  tier: Tier;
  size?: number;
}

export function WeaponPixelIcon({
  weaponType,
  tier,
  size = 40,
}: WeaponPixelIconProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSrc(weaponIconDataUrl(weaponType, tier));
    } catch {
      setSrc(null);
    }
  }, [weaponType, tier]);

  if (!src) {
    return (
      <span
        className="inline-block flex-shrink-0 rounded"
        style={{
          width: size,
          height: size,
          background: 'var(--qf-input-bg)',
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="flex-shrink-0"
      style={{ imageRendering: 'pixelated', width: size, height: size }}
      draggable={false}
    />
  );
}

export function CharmPixelIcon({ size = 40 }: { size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSrc(charmIconDataUrl());
    } catch {
      setSrc(null);
    }
  }, []);

  if (!src) {
    return (
      <span
        className="inline-block flex-shrink-0 rounded"
        style={{
          width: size,
          height: size,
          background: 'var(--qf-input-bg)',
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="flex-shrink-0"
      style={{ imageRendering: 'pixelated', width: size, height: size }}
      draggable={false}
    />
  );
}

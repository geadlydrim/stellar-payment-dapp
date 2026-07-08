'use client';

import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

export function QRCode({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCodeLib.toDataURL(value, {
      width: 160,
      margin: 1,
      color: { dark: '#0b1512', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className="w-[160px] h-[160px] rounded-xl qf-shimmer-bg" />;
  }

  return (
    <img
      src={dataUrl}
      alt="Wallet address QR code"
      width={160}
      height={160}
      className="rounded-xl border border-[var(--qf-card-border)]"
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders an EPC (SEPA) QR code from a pre-built payload string. */
export function SepaQR({ payload, size = 184 }: { payload: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: size })
      .then((url) => active && setSrc(url))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [payload, size]);

  if (error) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Impossibile generare il QR code.
      </p>
    );
  }
  if (!src) {
    return <div className="skeleton rounded-lg" style={{ width: size, height: size }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt="QR code SEPA per il bonifico"
      className="rounded-lg bg-white p-1"
    />
  );
}

import React, { useEffect, useState } from "react";

export default function Qr() {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const update = () => {
      const ts = Date.now();
      setSrc(`/qr/latest?ts=${ts}`);
    };
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">QR Code</h1>
      <div className="bg-wa-panel p-4 rounded-lg inline-block">
        {src ? (
          <img src={src} alt="QR" className="max-w-full" />
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}

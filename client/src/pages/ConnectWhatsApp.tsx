import { useState, useEffect } from "preact/hooks";
import "./ConnectWhatsApp.css";

export function ConnectWhatsApp() {
  const [state, setState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const handleConnect = () => {
    if (ws) {
      ws.close();
    }

    setState("connecting");
    setQrCode(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/whatsapp/connect`;
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      console.log("WebSocket connected");
    };

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "qr") {
        setQrCode(data.qrCode);
      } else if (data.type === "authenticated") {
        setState("connected");
        // Reload page to update auth state in App
        setTimeout(() => window.location.reload(), 1000);
      } else if (data.type === "error") {
        console.error("Connection error:", data.message);
        setState("disconnected");
      }
    };

    newWs.onerror = (error) => {
      console.error("WebSocket error:", error);
      setState("disconnected");
    };

    newWs.onclose = () => {
      console.log("WebSocket closed");
      if (state !== "connected") {
        setState("disconnected");
      }
    };

    setWs(newWs);
  };

  const handleDisconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
    setState("disconnected");
    setQrCode(null);
  };

  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  return (
    <div class="connect-page">
      <h2>Connect WhatsApp</h2>

      <div class="status-card">
        <div class={`status-indicator status-${state}`}>
          <span class="status-dot"></span>
          <span>
            {state === "connecting"
              ? "Connecting..."
              : state === "connected"
                ? "Connected!"
                : "Disconnected"}
          </span>
        </div>

        {state === "disconnected" && (
          <div style={{ marginTop: "1.5rem" }}>
            <p class="qr-instructions" style={{ marginBottom: "1rem" }}>
              Click the button below to connect your WhatsApp account
            </p>
            <button onClick={handleConnect} class="btn-primary">
              Connect WhatsApp
            </button>
          </div>
        )}

        {state === "connecting" && (
          <>
            {qrCode ? (
              <div class="qr-wrapper">
                <div class="qr-container">
                  <img src={qrCode} alt="WhatsApp QR Code" />
                </div>
                <p class="qr-instructions">
                  Open WhatsApp on your phone → Menu → Linked devices → Link a
                  device
                </p>
                <button onClick={handleDisconnect} class="btn-secondary">
                  Cancel
                </button>
              </div>
            ) : (
              <p class="qr-instructions">
                Opening browser and loading QR code...
              </p>
            )}
          </>
        )}

        {state === "connected" && (
          <div class="success-message">
            <p>✅ Successfully Connected!</p>
            <p class="qr-instructions">Redirecting...</p>
          </div>
        )}
      </div>
    </div>
  );
}

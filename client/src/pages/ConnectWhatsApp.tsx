import { useEffect, useState } from "preact/hooks";
import "./ConnectWhatsApp.css";

export function ConnectWhatsApp() {
  const [state, setState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [streamImage, setStreamImage] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState<{
    percent: number;
    message: string;
  } | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const handleConnect = () => {
    if (ws) {
      ws.close();
    }

    setState("connecting");
    setQrCode(null);
    setStreamImage(null);
    setLoadingInfo(null);

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
        setStreamImage(null);
        setLoadingInfo(null);
      } else if (data.type === "stream") {
        setStreamImage(data.image);
      } else if (data.type === "loading") {
        setLoadingInfo({ percent: data.percent, message: data.message });
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
    setStreamImage(null);
    setLoadingInfo(null);
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
            <div class="qr-wrapper">
              <div class="qr-container">
                {/* Prefer stream image if available, otherwise fall back to QR code or loader */}
                {streamImage ? (
                  <img
                    src={streamImage}
                    alt="WhatsApp Web Stream"
                    style={{ width: "100%", height: "auto" }}
                  />
                ) : qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" />
                ) : (
                  <div class="loading-placeholder">
                    {loadingInfo ? (
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontWeight: "bold", fontSize: "1.1em" }}>
                          {loadingInfo.message}
                        </p>
                        <div
                          style={{
                            width: "80%",
                            height: "8px",
                            background: "#e0e0e0",
                            margin: "10px auto",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${loadingInfo.percent}%`,
                              height: "100%",
                              background: "#00a884",
                              transition: "width 0.3s ease",
                            }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <p>Opening browser...</p>
                    )}
                  </div>
                )}
              </div>
              <p class="qr-instructions">
                Open WhatsApp on your phone → Menu → Linked devices → Link a
                device
              </p>
              <button onClick={handleDisconnect} class="btn-secondary">
                Cancel
              </button>
            </div>
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

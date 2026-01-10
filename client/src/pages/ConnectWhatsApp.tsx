import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";

export function ConnectWhatsApp() {
  const [status, setStatus] = useState<string>("initializing");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(false);

  const checkStatus = async () => {
    try {
      const data = await api.getWhatsAppStatus();
      setStatus(data.status);
      setAuthenticated(data.authenticated);
      setQrCode(data.qrCode);
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    if (confirm("This will restart the session. Continue?")) {
      await api.reconnectWhatsApp();
    }
  };

  return (
    <div class="connect-page">
      <h2>Connect WhatsApp</h2>

      <div class="status-card">
        <p>
          Status: <span className={`status-${status}`}>{status}</span>
        </p>
        {authenticated && <p className="success">Connected!</p>}
      </div>

      {!authenticated && qrCode && (
        <div class="qr-container">
          <p>Scan this QR code with WhatsApp on your phone</p>
          <img src={qrCode} alt="WhatsApp QR Code" />
        </div>
      )}

      {authenticated && (
        <button onClick={handleReconnect} class="btn-secondary">
          Reconnect / Restart Session
        </button>
      )}
    </div>
  );
}

import { AlertCircle, RefreshCw } from "lucide-preact";
import { useEffect } from "preact/hooks";
import { useRegisterSW } from "virtual:pwa-register/preact";
import "./ReloadPrompt.css";

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRegistered(r: any) {
      r &&
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000
        ); // Check for updates every hour
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRegisterError(error: any) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      console.log("App is ready to work offline");
      // Auto-hide offline ready message after 5 seconds
      const timer = setTimeout(() => setOfflineReady(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [offlineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="reload-prompt-container">
      <div className="reload-prompt-box">
        <div className="reload-prompt-info">
          <div className="reload-prompt-icon">
            {needRefresh ? <RefreshCw size={18} /> : <AlertCircle size={18} />}
          </div>
          <span className="reload-prompt-message">
            {needRefresh ? "New Update Available" : "Ready offline"}
          </span>
        </div>

        <div className="reload-prompt-actions">
          {needRefresh && (
            <button
              className="reload-btn-primary"
              onClick={() => updateServiceWorker(true)}
            >
              Update
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

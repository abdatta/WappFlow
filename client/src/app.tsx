import { useEffect, useState } from "preact/hooks";
import { Switch, Route } from "wouter-preact";
import { Layout } from "./components/Layout";
import { ConnectWhatsApp } from "./pages/ConnectWhatsApp";
import { Schedules } from "./pages/Schedules";
import { CreateSchedule } from "./pages/CreateSchedule";
import { Settings } from "./pages/Settings";
import { api } from "./services/api";

export function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean>(false);

  const checkStatus = async () => {
    try {
      const data = await api.getWhatsAppStatus();
      setAuthenticated(data.authenticated);
    } catch (err) {
      console.error("Failed to check WhatsApp status:", err);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{ maxWidth: "600px", margin: "2rem auto" }}>
        <ConnectWhatsApp />
      </div>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Schedules} />
        <Route path="/create" component={CreateSchedule} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <h2>404 - Not Found</h2>
            <p>Page does not exist</p>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}

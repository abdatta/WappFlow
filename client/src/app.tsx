import { Switch, Route } from "wouter-preact";
import { Layout } from "./components/Layout";
import { ConnectWhatsApp } from "./pages/ConnectWhatsApp";
import { Dashboard } from "./pages/Dashboard";
import { CreateSchedule } from "./pages/CreateSchedule";
import { Settings } from "./pages/Settings";

export function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/connect" component={ConnectWhatsApp} />
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

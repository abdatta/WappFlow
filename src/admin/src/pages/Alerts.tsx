import React, { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api";
import {
  Card,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";

interface AlertItem {
  ts: number;
  message: string;
}

const glassCard = {
  p: 3,
  borderRadius: 2,
  backgroundColor: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  transition: "transform .3s, box-shadow .3s",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 16px 32px rgba(0,0,0,0.4)",
  },
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastReady, setLastReady] = useState<boolean | null>(null);

  useEffect(() => {
    const interval = setInterval(check, 5000);
    check();
    return () => clearInterval(interval);
  }, []);

  async function check() {
    try {
      const health = await fetchHealth();
      if (lastReady === null) {
        setLastReady(health.session.ready);
        return;
      }
      if (health.session.ready !== lastReady) {
        const message = health.session.ready
          ? "Relinked / Ready"
          : "QR required or offline";
        setAlerts((prev) => [{ ts: Date.now(), message }, ...prev].slice(0, 20));
        setLastReady(health.session.ready);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4" fontWeight="bold">
        Alerts
      </Typography>
      <Card sx={glassCard}>
        <List>
          {alerts.map((a) => (
            <ListItem key={a.ts} divider>
              <ListItemText
                primary={a.message}
                secondary={new Date(a.ts).toLocaleString()}
              />
            </ListItem>
          ))}
          {alerts.length === 0 && (
            <Typography sx={{ p: 2 }} color="text.secondary">
              No alerts yet.
            </Typography>
          )}
        </List>
      </Card>
    </Stack>
  );
}

import React, { useEffect, useState } from "react";
import { fetchHealth, sendMessage, testPush, subscribePush } from "../lib/api";
import {
  Box,
  Button,
  Card,
  Checkbox,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

interface Health {
  session: { ready: boolean; qr: string | null };
  sentToday: number;
  perMinAvailable: number;
  dailyCap: number;
  headless: boolean;
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

function InfoCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card sx={glassCard}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1">{value}</Typography>
      </Card>
    </Grid>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [disablePrefix, setDisablePrefix] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    try {
      await sendMessage({ phone, text, disablePrefix });
      setMessage("Message sent");
      setPhone("");
      setText("");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Error sending");
    }
    refresh();
  }

  async function handleSubscribe() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: undefined,
    });
    await subscribePush(subscription);
    alert("Subscribed to push notifications");
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4" fontWeight="bold">
        Dashboard
      </Typography>
      {health && (
        <Grid container spacing={3}>
          <InfoCard
            title="Session"
            value={health.session.ready ? "Ready" : "Not ready"}
          />
          <InfoCard
            title="Daily Usage"
            value={`${health.sentToday} / ${health.dailyCap}`}
          />
          <InfoCard
            title="Minute Tokens"
            value={`${health.perMinAvailable} available`}
          />
          <InfoCard
            title="Headless"
            value={health.headless ? "Enabled" : "Disabled"}
          />
        </Grid>
      )}
      <Card sx={{ ...glassCard, display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h6" gutterBottom>
          Quick Send
        </Typography>
        <Box component="form" onSubmit={handleSend} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="E.164 Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
          />
          <TextField
            label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={disablePrefix}
                onChange={(e) => setDisablePrefix(e.target.checked)}
              />
            }
            label="Disable prefix"
          />
          <Button type="submit" variant="contained" color="primary">
            Send
          </Button>
        </Box>
        {message && (
          <Typography variant="body2" color="warning.main">
            {message}
          </Typography>
        )}
      </Card>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" color="secondary" onClick={handleSubscribe}>
          Subscribe to Push
        </Button>
        <Button variant="contained" color="info" onClick={() => testPush()}>
          Test Push
        </Button>
      </Stack>
    </Stack>
  );
}


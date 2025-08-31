import React, { useState, useEffect } from "react";
import { sendMessage, fetchTopContacts, fetchAllContacts } from "../lib/api";
import type { Contact } from "../lib/types";
import {
  Box,
  Button,
  Card,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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

export default function Send() {
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [text, setText] = useState("");
  const [disablePrefix, setDisablePrefix] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [topContacts, setTopContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  const suggestions = selected
    ? []
    : phone
    ? allContacts.filter(
        (c) =>
          c.phone?.includes(phone) ||
          c.name.toLowerCase().includes(phone.toLowerCase())
      )
    : showAll
    ? allContacts
    : topContacts;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = { text, disablePrefix };
      if (selected) {
        if (selected.phone) payload.phone = selected.phone;
        else payload.name = selected.name;
      } else if (phone) {
        payload.phone = phone;
      } else {
        throw new Error("Missing recipient");
      }
      await sendMessage(payload);
      setStatus("Message sent successfully");
      setPhone("");
      setSelected(null);
      setText("");
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Failed to send");
    }
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4" fontWeight="bold">
        Send Message
      </Typography>
      <Card sx={{ ...glassCard, maxWidth: 500 }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Contact"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSelected(null);
              if (e.target.value) setShowAll(false);
            }}
            fullWidth
          />
          {suggestions.length > 0 ? (
            <List sx={{ maxHeight: 200, overflow: "auto", mb: 1 }}>
              {suggestions.map((c) => (
                <ListItem key={c.phone || c.name} disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setSelected(c);
                      setPhone(
                        c.phone ? `${c.name} (${c.phone})` : c.name
                      );
                    }}
                  >
                    <ListItemText
                      primary={c.name}
                      secondary={c.phone || undefined}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            !phone && (
              <Typography variant="body2" color="text.secondary">
                No contacts yet. Add or import contacts to get started.
              </Typography>
            )
          )}
          {!phone && !showAll && allContacts.length > topContacts.length && (
            <Button onClick={() => setShowAll(true)} size="small">
              View all
            </Button>
          )}
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
          {status && (
            <Typography variant="body2" color="warning.main">
              {status}
            </Typography>
          )}
        </Box>
      </Card>
    </Stack>
  );
}

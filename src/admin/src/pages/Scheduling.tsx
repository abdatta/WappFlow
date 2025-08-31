import React, { useEffect, useState } from "react";
import {
  listSchedules,
  createSchedule,
  deleteSchedule,
  runSchedule,
  pauseSchedule,
  resumeSchedule,
  updateSchedule,
  fetchTopContacts,
  fetchAllContacts,
} from "../lib/api";
import type { Contact } from "../lib/types";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

interface Schedule {
  id: string;
  phone?: string;
  name?: string;
  text: string;
  disablePrefix: boolean;
  firstRunAt: string;
  nextRunAt: string;
  intervalMinutes: number | null;
  active: boolean;
  lastRunAt: string | null;
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

export default function Scheduling() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState({
    phone: "",
    text: "",
    disablePrefix: false,
    firstRunAt: "",
    intervalMinutes: "" as string | number,
    active: true,
  });
  const [selected, setSelected] = useState<Contact | null>(null);
  const [topContacts, setTopContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [edit, setEdit] = useState<{
    id: string;
    text: string;
    disablePrefix: boolean;
    firstRunAt: string;
    intervalMinutes: string | number;
    active: boolean;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const suggestions = selected
    ? []
    : form.phone
    ? allContacts.filter(
        (c) =>
          c.phone?.includes(form.phone) ||
          c.name.toLowerCase().includes(form.phone.toLowerCase())
      )
    : showAll
    ? allContacts
    : topContacts;

  useEffect(() => {
    refresh();
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  async function refresh() {
    try {
      const data = await listSchedules();
      setSchedules(data.items);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = {
        text: form.text,
        disablePrefix: form.disablePrefix,
        active: form.active,
      };
      if (selected) {
        if (selected.phone) payload.phone = selected.phone;
        else payload.name = selected.name;
      } else if (form.phone) {
        payload.phone = form.phone;
      } else {
        throw new Error("Missing contact");
      }
      if (form.firstRunAt)
        payload.firstRunAt = new Date(form.firstRunAt).toISOString();
      if (form.intervalMinutes)
        payload.intervalMinutes = Number(form.intervalMinutes);
      await createSchedule(payload);
      setStatus("Schedule created");
      setForm({
        phone: "",
        text: "",
        disablePrefix: false,
        firstRunAt: "",
        intervalMinutes: "",
        active: true,
      });
      setSelected(null);
      refresh();
    } catch (err: any) {
      setStatus(err.response?.data?.error || err.message || "Error creating");
    }
  }

  async function handleDelete(id: string) {
    await deleteSchedule(id);
    refresh();
  }
  async function handleRun(id: string) {
    await runSchedule(id);
    refresh();
  }
  async function handlePause(id: string) {
    await pauseSchedule(id);
    refresh();
  }
  async function handleResume(id: string) {
    await resumeSchedule(id);
    refresh();
  }
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    await updateSchedule(edit.id, {
      text: edit.text,
      disablePrefix: edit.disablePrefix,
      firstRunAt: edit.firstRunAt ? new Date(edit.firstRunAt).toISOString() : undefined,
      intervalMinutes: edit.intervalMinutes ? Number(edit.intervalMinutes) : undefined,
      active: edit.active,
    });
    setEdit(null);
    refresh();
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4" fontWeight="bold">
        Scheduling
      </Typography>
      <Card sx={glassCard}>
        <Box
          component="form"
          onSubmit={handleCreate}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Contact"
            value={form.phone}
            onChange={(e) => {
              setForm({ ...form, phone: e.target.value });
              setSelected(null);
              if (e.target.value) setShowAll(false);
            }}
            fullWidth
          />
          {suggestions.length > 0 && (
            <List sx={{ maxHeight: 200, overflow: "auto", mb: 1 }}>
              {suggestions.map((c) => (
                <ListItem key={c.phone || c.name} disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setSelected(c);
                      setForm({ ...form, phone: c.phone ? `${c.name} (${c.phone})` : c.name });
                    }}
                  >
                    <ListItemText primary={c.name} secondary={c.phone || undefined} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
          {!form.phone && !showAll && allContacts.length > topContacts.length && (
            <Button onClick={() => setShowAll(true)} size="small">
              View all
            </Button>
          )}
          <TextField
            label="Message"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            multiline
            minRows={3}
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.disablePrefix}
                onChange={(e) => setForm({ ...form, disablePrefix: e.target.checked })}
              />
            }
            label="Disable prefix"
          />
          <TextField
            label="First run (local)"
            type="datetime-local"
            value={form.firstRunAt}
            onChange={(e) => setForm({ ...form, firstRunAt: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Interval (minutes)"
            type="number"
            value={form.intervalMinutes}
            onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })}
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            }
            label="Active"
          />
          <Button type="submit" variant="contained" color="primary">
            Create Schedule
          </Button>
          {status && (
            <Typography variant="body2" color="warning.main">
              {status}
            </Typography>
          )}
        </Box>
      </Card>
      <Card sx={glassCard}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>To</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.phone || s.name}</TableCell>
                <TableCell>{s.text}</TableCell>
                <TableCell>{new Date(s.nextRunAt).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() =>
                    setEdit({
                      id: s.id,
                      text: s.text,
                      disablePrefix: s.disablePrefix,
                      firstRunAt: s.firstRunAt ? s.firstRunAt.slice(0,16) : "",
                      intervalMinutes: s.intervalMinutes ?? "",
                      active: s.active,
                    })
                  }>Edit</Button>
                  <Button size="small" onClick={() => handleRun(s.id)}>Run</Button>
                  {s.active ? (
                    <Button size="small" onClick={() => handlePause(s.id)}>Pause</Button>
                  ) : (
                    <Button size="small" onClick={() => handleResume(s.id)}>Resume</Button>
                  )}
                  <Button size="small" color="error" onClick={() => handleDelete(s.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Schedule</DialogTitle>
        {edit && (
          <Box component="form" onSubmit={handleUpdate}>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Message"
                value={edit.text}
                onChange={(e) => setEdit({ ...edit, text: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={edit.disablePrefix}
                    onChange={(e) => setEdit({ ...edit, disablePrefix: e.target.checked })}
                  />
                }
                label="Disable prefix"
              />
              <TextField
                label="First run (local)"
                type="datetime-local"
                value={edit.firstRunAt}
                onChange={(e) => setEdit({ ...edit, firstRunAt: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Interval (minutes)"
                type="number"
                value={edit.intervalMinutes}
                onChange={(e) => setEdit({ ...edit, intervalMinutes: e.target.value })}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={edit.active}
                    onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </Stack>
  );
}

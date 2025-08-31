import React from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Send from "./pages/Send";
import Scheduling from "./pages/Scheduling";
import Alerts from "./pages/Alerts";
import Qr from "./pages/Qr";

import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";

export default function App() {
  const [mode, setMode] = React.useState<"light" | "dark">("dark");

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#00e5ff" },
          secondary: { main: "#7c4dff" },
          background: {
            default: mode === "dark" ? "#0a1929" : "#fafafa",
            paper: mode === "dark" ? "rgba(255,255,255,0.05)" : "#fff",
          },
        },
        typography: {
          fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
          fontWeightBold: 700,
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                backdropFilter: "blur(12px)",
              },
            },
          },
        },
      }),
    [mode]
  );

  const navButton = ({ isActive }: { isActive: boolean }) => ({
    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
    mx: 1,
    transition: "color .3s",
    "&:hover": {
      color: theme.palette.primary.light,
      transform: "translateY(-2px)",
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: "blur(12px)",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              fontWeight: 800,
              background: "linear-gradient(45deg,#5B86E5,#36D1DC)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Admin
          </Typography>
          <NavLink to="/" end>
            {({ isActive }) => (
              <Button sx={navButton({ isActive })}>Dashboard</Button>
            )}
          </NavLink>
          <NavLink to="/send">
            {({ isActive }) => <Button sx={navButton({ isActive })}>Send</Button>}
          </NavLink>
          <NavLink to="/scheduling">
            {({ isActive }) => (
              <Button sx={navButton({ isActive })}>Scheduling</Button>
            )}
          </NavLink>
          <NavLink to="/alerts">
            {({ isActive }) => (
              <Button sx={navButton({ isActive })}>Alerts</Button>
            )}
          </NavLink>
          <NavLink to="/qr">
            {({ isActive }) => <Button sx={navButton({ isActive })}>QR</Button>}
          </NavLink>
          <IconButton
            color="inherit"
            onClick={() => setMode(mode === "light" ? "dark" : "light")}
            sx={{
              ml: 1,
              transition: "transform .3s",
              "&:hover": { transform: "rotate(20deg)" },
            }}
          >
            {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          flexGrow: 1,
          p: 3,
          minHeight: "100vh",
          background:
            mode === "dark"
              ? "radial-gradient(circle at top left, #1e3a8a, #0f172a)"
              : "linear-gradient(135deg,#fdfbfb 0%,#ebedee 100%)",
          transition: "background .5s",
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/send" element={<Send />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/qr" element={<Qr />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
}


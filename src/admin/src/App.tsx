import React from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import {
  HomeIcon,
  PaperAirplaneIcon,
  ClockIcon,
  BellIcon,
  QrCodeIcon,
} from "./lib/icons";
import Dashboard from "./pages/Dashboard";
import Send from "./pages/Send";
import Scheduling from "./pages/Scheduling";
import Alerts from "./pages/Alerts";
import Qr from "./pages/Qr";

const navItems = [
  { to: "/", label: "Dashboard", icon: HomeIcon },
  { to: "/send", label: "Send", icon: PaperAirplaneIcon },
  { to: "/scheduling", label: "Scheduling", icon: ClockIcon },
  { to: "/alerts", label: "Alerts", icon: BellIcon },
  { to: "/qr", label: "QR", icon: QrCodeIcon },
];

const navClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? "bg-wa-green text-wa-bg"
      : "text-gray-300 hover:bg-wa-hover hover:text-white"
  }`;

export default function App() {
  return (
    <div className="min-h-screen flex bg-wa-bg text-gray-100">
      <nav className="w-56 bg-wa-panel p-4 space-y-2">
        <div className="text-2xl font-semibold text-wa-green mb-6">
          WappFlow
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={navClasses}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/send" element={<Send />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/qr" element={<Qr />} />
        </Routes>
      </main>
    </div>
  );
}

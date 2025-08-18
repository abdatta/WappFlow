import React from "react";
import { NavLink, Routes, Route, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Send from "./pages/Send";
import Scheduling from "./pages/Scheduling";
import Alerts from "./pages/Alerts";
import Qr from "./pages/Qr";

const navClasses = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`;

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-800 px-4 py-3 flex gap-4">
        <NavLink to="/" end className={navClasses}>
          Dashboard
        </NavLink>
        <NavLink to="/send" className={navClasses}>
          Send
        </NavLink>
        <NavLink to="/scheduling" className={navClasses}>
          Scheduling
        </NavLink>
        <NavLink to="/alerts" className={navClasses}>
          Alerts
        </NavLink>
        <NavLink to="/qr" className={navClasses}>
          QR
        </NavLink>
      </nav>
      <main className="flex-1 p-4 overflow-auto">
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

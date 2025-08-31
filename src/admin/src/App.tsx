import React, { useEffect, useState } from "react";

export default function App() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const navItems = ["Dashboard", "Messages", "Analytics", "Settings"];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-100">
      <aside className="hidden md:flex md:flex-col w-64 p-6 bg-black/30 backdrop-blur-xl border-r border-green-500/20">
        <h1 className="text-2xl font-bold mb-8 text-green-400">WappFlow</h1>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              className="block px-4 py-2 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition"
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        <header className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold text-green-400">Dashboard</h2>
          <button
            onClick={() => setDark(!dark)}
            className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </header>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-lg shadow-lg hover:shadow-green-500/20 transition">
            <p className="text-sm uppercase tracking-wide text-gray-400">Sessions</p>
            <p className="mt-2 text-3xl font-bold text-green-400">8</p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-lg shadow-lg hover:shadow-green-500/20 transition">
            <p className="text-sm uppercase tracking-wide text-gray-400">Messages</p>
            <p className="mt-2 text-3xl font-bold text-green-400">1.2k</p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-lg shadow-lg hover:shadow-green-500/20 transition">
            <p className="text-sm uppercase tracking-wide text-gray-400">Deliveries</p>
            <p className="mt-2 text-3xl font-bold text-green-400">98%</p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-lg shadow-lg hover:shadow-green-500/20 transition">
            <p className="text-sm uppercase tracking-wide text-gray-400">Errors</p>
            <p className="mt-2 text-3xl font-bold text-green-400">2</p>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-lg shadow-lg">
            <h3 className="mb-4 font-semibold text-green-400">Overview</h3>
            <div className="h-48 flex items-center justify-center text-gray-500">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <polyline
                  fill="none"
                  stroke="#25D366"
                  strokeWidth="3"
                  points="0,80 40,60 80,65 120,20 160,30 200,10"
                />
              </svg>
            </div>
          </div>
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-lg shadow-lg">
            <h3 className="mb-4 font-semibold text-green-400">Customers</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  SJ
                </span>
                <div>
                  <p className="font-medium">Sarah Johnson</p>
                  <p className="text-sm text-gray-400">Active</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  RB
                </span>
                <div>
                  <p className="font-medium">Rahul B</p>
                  <p className="text-sm text-gray-400">Offline</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  MK
                </span>
                <div>
                  <p className="font-medium">Maria K</p>
                  <p className="text-sm text-gray-400">Active</p>
                </div>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}


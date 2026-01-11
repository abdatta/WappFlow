import { Link, useLocation } from "wouter-preact";
import { Calendar, Plus, Settings } from "lucide-preact";

export function Layout({ children }: { children: any }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Calendar, label: "Schedules" },
    { href: "/create", icon: Plus, label: "Create" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div class="app-container">
      <header class="app-header">
        <h1>WappFlow</h1>
      </header>

      <main class="app-content">{children}</main>

      <nav class="app-nav">
        {navItems.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            className={`nav-item ${location === item.href ? "active" : ""}`}
          >
            <item.icon size={24} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

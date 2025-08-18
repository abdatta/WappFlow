# WappFlow - A WhatsApp Web Automation Bot

WappFlow implements a simple automation bot for WhatsApp Web. It provides a Node/TypeScript backend with an in‑process scheduler and a modern React/Tailwind admin interface. The bot can send text messages, schedule recurring sends and deliver web push notifications about session status.

## ⚠️ Terms of Service

Automating WhatsApp Web may violate WhatsApp’s Terms of Service. Use this project at your own risk. Running a bot against the official client can lead to account bans or other penalties. This code is provided for educational purposes and is not affiliated with WhatsApp.

## Features

- **Text messages only**: no media support.
- **Headless by default**: runs the Chromium browser in headless mode; can be toggled via `data/settings.json`.
- **Rate limiting**: token bucket (per‑minute) and daily caps with warmup tiers.
- **JSON persistence**: all state (settings, limits, schedules, session, subscriptions) lives in the `data/` folder.
- **In‑process scheduler**: supports one‑off and recurring jobs with at least 60 minute intervals.
- **Web push notifications**: informs you when a QR relink is required, the session is relinked or your phone goes offline.
- **React admin UI**: dark themed dashboard, send form, schedule management, alert feed and QR viewer.

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone <your-repo-url> wappflow
cd wappflow
npm install

# 2. Bootstrap runtime state
npm run setup

# 3. Install Playwright browser
npm run playwright:install

# 4. Run backend (serves admin UI on :3030)
npm run dev
```

Then open http://localhost:5173/admin in your browser.
Scan the QR code with WhatsApp to link your session.

## Getting started

Clone the repository and install dependencies:

```bash
npm install
```

Install the Playwright browser once:

```bash
npx playwright install chromium
```

### VAPID keys

Generate VAPID keys for web push notifications:

```bash
npm run vapid
```

The script writes new keys into `data/settings.json` and prints the public key. If you plan to deploy the admin UI separately you will need to copy the public key into your front‑end configuration.

### Running the backend

To start the development server with automatic reload:

```bash
npm run dev
```

For a production build run:

```bash
npm run build
npm start
```

By default the server listens on port `3030` and serves the admin UI at `http://localhost:3030/admin` after you build it.

### Running the admin

The admin UI is a Vite/React application located in `src/admin`. To develop it with hot reload:

```bash
npm run admin:dev
```

To build the admin for production (output goes to `src/admin/dist`):

```bash
npm run admin:build
```

The Express server will automatically serve the contents of this directory at `/admin/*`.

### First run

1. Build the admin UI (`npm run admin:build`) then start the backend (`npm run dev`).
2. Open `http://localhost:3030/admin` in your browser. You should see the dashboard.
3. Subscribe to push notifications using the button on the dashboard. Your browser will ask for permission.
4. When the bot starts for the first time WhatsApp will ask you to scan a QR code. Navigate to the **QR** page to see the code. A push notification will also appear.
5. Scan the QR code with your phone’s WhatsApp app. After successful linking the dashboard will show the session as ready and you will receive a “Relinked” notification.
6. Use the **Send** or **Quick Send** forms to send messages to valid E.164 numbers. Scheduled messages can be configured on the **Scheduling** page.

### Configuration

- `data/settings.json` – core settings such as headless mode, prefix text, rate limits, VAPID keys and the default size of the top contacts list. Edit this file to change the default prefix or timezone. The bot will recreate this file on first run if missing.
- `data/limits.json` – current rate limiting state. It is updated automatically.
- `data/schedules.json` – stored schedules. Do not edit by hand unless the server is stopped.
- `data/contacts.json` – cached contacts with usage counts used for top contacts and search.
- `data/subs.json` – web push subscriptions. Cleared when you revoke browser permission.
- `.env.example` – template for environment variables. Copy it to `.env` and adjust values if needed.

### Troubleshooting

- **The bot is not ready / QR required**: navigate to the QR page and scan the code again. Make sure your phone has an active internet connection.
- **Push notifications not working**: ensure you generated VAPID keys and subscribed to push notifications. Some browsers block push on insecure origins.
- **Rate limit errors**: the bot enforces per‑minute and per‑day limits. During the warmup period the limits are lower. You can inspect `data/limits.json` to see current counters.
- **Session lost on restart**: Playwright uses a persistent profile stored under `profiles/whatsapp`. Deleting this directory will require relinking your WhatsApp account.

---

This project is provided as is without warranty. Use it responsibly and respect the terms of service of the platforms you automate.

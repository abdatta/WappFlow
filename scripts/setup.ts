// scripts/setup.ts
import fs from "fs";
import path from "path";

type Json = Record<string, any> | string;

const dataDir = path.join(process.cwd(), "data");

const defaults: Record<string, Json> = {
  "settings.json": {
    headless: false,
    timezone: "America/Los_Angeles",
    rate: { perMin: 10, perDay: 200, warmup: true, firstRunAt: null },
    prefix: { text: "[wappbot]: ", defaultEnabled: true },
    vapid: { publicKey: "", privateKey: "" },
    topContactsN: 10,
    contactsRefreshInterval: 3600,
  },
  "limits.json": {
    tokens: 10,
    updatedAt: 0,
    sentToday: 0,
    today: "1970-01-01",
  },
  "subs.json": { subs: [] },
  "session.json": { qr: null, ready: false, lastReadyAt: null },
  "schedules.json": { schedules: [], meta: { tz: "America/Los_Angeles" } },
  "contacts.json": { contacts: [] },
  "sends.log.jsonl": "", // append-only log
};

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const RESET_VAPID = args.has("--reset-vapid");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJsonSafe<T = any>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeAtomic(file: string, contents: string) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

function createOrResetFile(name: string, content: Json) {
  const file = path.join(dataDir, name);

  // Special case: preserve VAPID keys unless --reset-vapid
  if (
    name === "settings.json" &&
    fs.existsSync(file) &&
    (FORCE || !fs.existsSync(file))
  ) {
    const current = readJsonSafe<Record<string, any>>(file);
    if (current && current.vapid && !RESET_VAPID) {
      const merged = {
        ...(content as Record<string, any>),
        vapid: {
          publicKey: current.vapid.publicKey ?? "",
          privateKey: current.vapid.privateKey ?? "",
        },
      };
      writeAtomic(file, JSON.stringify(merged, null, 2));
      console.log(
        `${FORCE ? "Reset" : "Created"} ${name} (preserved VAPID keys)`,
      );
      return;
    }
  }

  if (!fs.existsSync(file) || FORCE) {
    if (typeof content === "string") {
      writeAtomic(file, content);
    } else {
      writeAtomic(file, JSON.stringify(content, null, 2));
    }
    console.log(
      `${fs.existsSync(file) && FORCE ? "Reset" : "Created"} ${name}`,
    );
  } else {
    console.log(`OK (exists) ${name}`);
  }
}

function ensureSettingsDefaults() {
  const file = path.join(dataDir, "settings.json");
  const current = readJsonSafe<Record<string, any>>(file);
  if (!current) return;

  let updated = false;
  if (typeof current.topContactsN !== "number") {
    current.topContactsN = 10;
    console.log("Updated settings.json with topContactsN");
    updated = true;
  }

  if (typeof current.contactsRefreshInterval !== "number") {
    current.contactsRefreshInterval = 3600;
    console.log("Updated settings.json with contactsRefreshInterval");
    updated = true;
  }

  if (updated) {
    writeAtomic(file, JSON.stringify(current, null, 2));
  }
}

function main() {
  console.log(
    `Bootstrapping data/ ${FORCE ? "(force reset enabled)" : "(create-only)"}`,
  );
  ensureDir(dataDir);

  Object.entries(defaults).forEach(([name, content]) => {
    createOrResetFile(name, content);
  });

  ensureSettingsDefaults();

  console.log("Setup complete ✅");
  if (FORCE && !RESET_VAPID) {
    console.log(
      "Note: VAPID keys were preserved. Use --reset-vapid to wipe them.",
    );
  }
}

main();

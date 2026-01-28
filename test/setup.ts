import { beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  // Check if LOGS environment variable is set or specific flag is present
  const showLogs =
    process.env.LOGS === "true" || process.argv.includes("--logs");

  if (!showLogs) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

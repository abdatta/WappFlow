import dayjs from "dayjs";

/**
 * Overrides the global console methods to prepend a timestamp.
 * Format: [DD MMM HH:mm:ss]
 */
export function overrideConsole() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  const getTimestamp = () => {
    return `[${dayjs().format("DD MMM HH:mm:ss")}]`;
  };

  console.log = (...args: any[]) => {
    originalLog(getTimestamp(), ...args);
  };

  console.warn = (...args: any[]) => {
    originalWarn(getTimestamp(), ...args);
  };

  console.error = (...args: any[]) => {
    originalError(getTimestamp(), ...args);
  };

  console.debug = (...args: any[]) => {
    originalDebug(getTimestamp(), ...args);
  };
}

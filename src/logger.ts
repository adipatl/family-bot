import pino from "pino";

// Cloud Logging severity mapping (pino level number → GCP severity string)
const LEVEL_TO_SEVERITY: Record<number, string> = {
  10: "DEBUG",
  20: "DEBUG",
  30: "INFO",
  40: "WARNING",
  50: "ERROR",
  60: "CRITICAL",
};

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level(label, number) {
      return { severity: LEVEL_TO_SEVERITY[number] ?? "DEFAULT", level: label };
    },
  },
  messageKey: "message",
});

/**
 * Create a child logger scoped to a component.
 * Usage: const log = createLogger("webhook");
 */
export function createLogger(component: string) {
  return logger.child({ component });
}

export default logger;

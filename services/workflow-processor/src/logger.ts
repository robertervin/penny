import pino from "pino";

export function createLogger(level = "info") {
  return pino({
    level,
    base: { service: "penny-workflow-processor" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;

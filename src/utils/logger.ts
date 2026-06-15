/** Structured log levels */
type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  stage: string;
  message: string;
  data?: Record<string, unknown> | undefined;
}

/**
 * Minimal structured logger.
 * Writes JSON-serialisable entries to stderr (errors) or stdout (everything else).
 * Replace the `_emit` method to route to Winston / Pino / CloudWatch etc.
 */
class Logger {
  private readonly isDev = process.env.NODE_ENV !== "production";

  private _emit(entry: LogEntry): void {
    const line = this.isDev
      ? `[${entry.level.toUpperCase()}] [${entry.stage}] ${entry.message}${
          entry.data ? " " + JSON.stringify(entry.data) : ""
        }`
      : JSON.stringify(entry);

    if (entry.level === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }

  private log(level: LogLevel, stage: string, message: string, data?: Record<string, unknown>): void {
    this._emit({
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      data,
    });
  }

  info(stage: string, message: string, data?: Record<string, unknown>): void {
    this.log("info", stage, message, data);
  }

  warn(stage: string, message: string, data?: Record<string, unknown>): void {
    this.log("warn", stage, message, data);
  }

  error(stage: string, message: string, data?: Record<string, unknown>): void {
    this.log("error", stage, message, data);
  }

  debug(stage: string, message: string, data?: Record<string, unknown>): void {
    if (this.isDev) this.log("debug", stage, message, data);
  }
}

/** Singleton logger instance used across the pipeline */
export const logger = new Logger();

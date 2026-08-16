import type { ILogLevels, ISender, IMessage, ILabels } from './interfaces.ts';

/**
 * createMessage - builds a message with the given log level and labels, an
 * empty string value, and the current time as its timestamp
 */
export function createMessage(logLevel: number = DEFAULT_LOG_LEVELS.log, labels: ILabels = {}): IMessage {
  return {
    logLevel,
    labels,
    value: '',
    timestamp: new Date(),
  };
}

/**
 * DEFAULT_LOG_LEVELS - the standard log levels, matching the logging
 * methods available on the console object
 */
export const DEFAULT_LOG_LEVELS = {
  debug: 10,
  log: 10,
  info: 30,
  warn: 40,
  error: 50,
} as const satisfies ILogLevels;

/**
 * LogFunction - a logging method created for a specific log level. Takes
 * the value to log and, optionally, labels to merge with the logger's
 * default labels for this call only.
 */
export type LogFunction = (value: unknown, labels?: ILabels) => void;

/**
 * LogMethods - the logging methods dynamically created for a set of log
 * levels, one per level name
 */
export type LogMethods<L extends ILogLevels> = {
  [K in keyof L]: LogFunction;
};

/**
 * LoggerWithLevels - a Logger with its log-level methods (e.g. `.debug()`,
 * `.info()`) typed for the given log levels
 */
export type LoggerWithLevels<L extends ILogLevels = typeof DEFAULT_LOG_LEVELS> = Logger<L> & LogMethods<L>;

/**
 * Logger - sends messages to an ISender, exposing a logging method for
 * each configured log level. Those methods are created once, when the
 * logger is constructed, so use createLogger() over this constructor
 * directly to get them fully typed.
 */
export class Logger<L extends ILogLevels = typeof DEFAULT_LOG_LEVELS> {
  private _sender: ISender;
  private _logLevels: L;
  private _labels: ILabels;

  constructor(sender: ISender, logLevels: L = DEFAULT_LOG_LEVELS as unknown as L, labels: ILabels = {}) {
    this._sender = sender;
    this._logLevels = (logLevels ?? DEFAULT_LOG_LEVELS) as unknown as L;
    this._labels = labels;
    this._createLogMethods();
  }

  /**
   * _createLogMethods - creates this logger's logging method for each
   * configured log level, throwing if a level name would collide with one
   * of Logger's own members
   */
  private _createLogMethods(): void {
    const reservedNames = Object.getOwnPropertyNames(Logger.prototype);
    const collision = Object.keys(this._logLevels).find((key) => reservedNames.includes(key));
    if (collision !== undefined) {
      throw new Error(`Log level name "${collision}" collides with an existing Logger method`);
    }

    const methods = this as unknown as Record<string, LogFunction>;
    Object.keys(this._logLevels).forEach((key) => {
      methods[key] = (value: unknown, labels: ILabels = {}) => {
        const message = createMessage(this._logLevels[key], { ...this._labels, ...labels });
        message.value = value;
        this._sender.send(message);
      };
    });
  }

  /**
   * logLevels - the log levels used to create this logger's logging
   * methods
   */
  get logLevels(): L {
    return this._logLevels;
  }

  /**
   * labels - the default labels applied to every message this logger
   * sends
   */
  get labels(): ILabels {
    return this._labels;
  }

  set labels(labels: ILabels) {
    this._labels = labels ?? {};
  }

  /**
   * createLogFunction - builds a one-off logging function for a specific
   * log level and fixed labels, independent of this logger's configured
   * log levels
   */
  createLogFunction(logLevel: number, labels: ILabels = {}): (value: unknown) => void {
    return (value: unknown) => {
      const message = createMessage(logLevel, labels);
      message.value = value;
      this._sender.send(message);
    };
  }
}

/**
 * createLogger - builds a Logger whose per-level logging methods (e.g.
 * `.debug()`, `.info()`) are typed for the given log levels, instead of
 * only being known at runtime
 */
export function createLogger<L extends ILogLevels = typeof DEFAULT_LOG_LEVELS>(
  sender: ISender,
  logLevels: L = DEFAULT_LOG_LEVELS as unknown as L,
  labels: ILabels = {},
): LoggerWithLevels<L> {
  return new Logger(sender, logLevels, labels) as LoggerWithLevels<L>;
}

export default Logger;

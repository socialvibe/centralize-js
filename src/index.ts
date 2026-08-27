import type {
  ISender,
  IMessage,
  IReceiver,
  IInterceptor,
  ILabels,
  ILogLevels,
  MatchConditionOperator,
  MatchConditionOperatorInput,
} from './interfaces.ts';
import { Stream } from './stream.ts';
import LoggerClass, { createLogger, DEFAULT_LOG_LEVELS, createMessage } from './logger.ts';
import type { LogFunction, LogMethods, LoggerWithLevels } from './logger.ts';

/**
 * MessageHub - the root sender all messages flow through. Exposes its
 * underlying stream via `messages` so consumers can filter and subscribe
 * to it.
 */
class MessageHub implements ISender {
  private _stream: Stream;

  constructor() {
    this._stream = new Stream();
  }

  /**
   * messages - the root stream every message sent to this hub is
   * published to
   */
  get messages(): Stream {
    return this._stream;
  }

  /**
   * send - publishes a message to the hub's stream, on a copy with a
   * timestamp (filled in when one isn't already a valid Date) and labels
   * (defaulted to an empty object when missing)
   */
  send(msg: IMessage): void {
    const message: IMessage = {
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(),
      labels: msg.labels ?? {},
    };
    this._stream.send(message);
  }
}

export const Hub = new MessageHub();
export { LoggerClass, createLogger };
export { DEFAULT_LOG_LEVELS as LOG_LEVELS };

const defaultLogger = createLogger(Hub, DEFAULT_LOG_LEVELS);
export { defaultLogger as Logger };
export { createMessage as CreateMessage };

export type {
  IMessage,
  ISender,
  IReceiver,
  IInterceptor,
  ILabels,
  ILogLevels,
  MatchConditionOperator,
  MatchConditionOperatorInput,
  Stream,
  LogFunction,
  LogMethods,
  LoggerWithLevels,
};

export default defaultLogger;

/**
 * ILabels - a map of labels attached to a message, used for filtering and
 * routing (e.g. matchLabels, matchCondition)
 */
export interface ILabels {
  [key: string]: unknown;
}

/**
 * IMessage - a message sent through the hub
 */
export interface IMessage {
  logLevel: number;
  labels: ILabels;
  value: unknown;
  timestamp?: Date;
}

/**
 * ILogLevels - a map of log level names to their numeric priority
 */
export interface ILogLevels {
  [key: string]: number;
}

/**
 * ISender - anything that can send a message
 */
export interface ISender {
  send(msg: IMessage): void;
}

/**
 * IReceiver - a consumer of messages from a stream
 */
export interface IReceiver {
  (msg: IMessage): void;
}

/**
 * IInterceptor - modifies a message before it reaches a stream's receivers.
 * Return the (possibly modified) message, or null/undefined to stop it
 * from propagating any further.
 */
export interface IInterceptor {
  (msg: IMessage): IMessage | null | undefined;
}

/**
 * MatchConditionOperator - the operators supported by Stream.matchCondition()
 */
export type MatchConditionOperator = 'IN' | 'NOT_IN' | 'NOT';

/**
 * MatchConditionOperatorInput - an operator as accepted by
 * Stream.matchCondition(), which is case-insensitive and normalizes it to
 * its canonical uppercase form
 */
export type MatchConditionOperatorInput = MatchConditionOperator | Lowercase<MatchConditionOperator>;

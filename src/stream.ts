import type {
  ILabels,
  IMessage,
  IReceiver,
  IInterceptor,
  MatchConditionOperator,
  MatchConditionOperatorInput,
} from './interfaces.ts';

/**
 * Stream - a channel that messages can be sent to and received from. Streams
 * can be filtered into narrower substreams via matchAll(), matchLabels(),
 * and matchCondition().
 */
export class Stream {
  private _receivers: IReceiver[] = [];
  private _interceptors: IInterceptor[] = [];
  private readonly _parentStream: Stream | undefined;
  private _logLevel: number | undefined;

  constructor(parentStream?: Stream) {
    if (parentStream !== undefined && !(parentStream instanceof Stream)) {
      throw new Error('parentStream must be a Stream or undefined');
    }
    this._parentStream = parentStream;
  }

  /**
   * matchAll - creates a substream that receives every message sent to this
   * stream
   */
  matchAll(): Stream {
    return new MatchAllStream(this);
  }

  /**
   * matchLabels - creates a substream that only receives messages whose
   * labels match all of the given labels
   */
  matchLabels(labels: ILabels): Stream {
    return new MatchLabelsStream(this, labels);
  }

  /**
   * matchCondition - creates a substream that only receives messages whose
   * label at `key` satisfies `operator` against `value`. The operator is
   * case-insensitive.
   */
  matchCondition(key: string, operator: MatchConditionOperatorInput, value: unknown): Stream {
    return new MatchConditionStream(this, {
      key,
      operator: String(operator).toUpperCase() as MatchConditionOperator,
      value,
    });
  }

  /**
   * logLevel - the minimum log level a message must have to reach this
   * stream's receivers
   */
  get logLevel(): number | undefined {
    return this._logLevel;
  }

  set logLevel(logLevel: number) {
    this._logLevel = logLevel;
  }

  /**
   * addReceiver - registers a consumer of messages sent to this stream
   */
  addReceiver(receiver: IReceiver): () => void {
    this._receivers.push(receiver);
    return () => {
      this.removeReceiver(receiver);
    };
  }

  /**
   * removeReceiver - unregisters a consumer from this stream
   */
  removeReceiver(receiver: IReceiver): void {
    this._receivers = this._receivers.filter((r) => r !== receiver);
  }

  /**
   * addInterceptor - registers an interceptor that can modify or drop
   * messages before they reach this stream's receivers
   */
  addInterceptor(interceptor: IInterceptor): () => void {
    this._interceptors.push(interceptor);
    return () => {
      this.removeInterceptor(interceptor);
    };
  }

  /**
   * removeInterceptor - unregisters an interceptor from this stream
   */
  removeInterceptor(interceptor: IInterceptor): void {
    this._interceptors = this._interceptors.filter((i) => i !== interceptor);
  }

  /**
   * send - runs a message through this stream's interceptors, in
   * registration order, then forwards the result to all receivers. An
   * interceptor may stop propagation by returning null or undefined; any
   * other non-object return value is ignored and the previous message
   * carries on to the next interceptor instead.
   */
  send(msg: IMessage): void {
    if (this._logLevel !== undefined && (typeof msg.logLevel !== 'number' || msg.logLevel < this._logLevel)) {
      return;
    }

    let current: IMessage = msg;
    for (const interceptor of this._interceptors) {
      const result = interceptor(current);
      if (result == null) {
        return;
      }
      if (typeof result === 'object') {
        current = result;
      }
    }

    this._receivers.forEach((receiver) => receiver(current));
  }

  /**
   * hasReceivers - whether this stream currently has any registered
   * receivers
   */
  protected get hasReceivers(): boolean {
    return this._receivers.length > 0;
  }

  /**
   * parentStream - the stream this stream was filtered from, or undefined
   * for a root stream
   */
  protected get parentStream(): Stream | undefined {
    return this._parentStream;
  }
}

/**
 * StreamFilter - base class for substreams that filter messages coming from
 * a parent stream. The filter attaches its rule to the parent once the
 * first receiver is added, and detaches once the last receiver is removed,
 * so unused filters don't keep leaking receivers on their parent. Adding a
 * receiver again after a full detach reattaches it.
 */
abstract class StreamFilter extends Stream {
  private readonly _boundRule: IReceiver = (msg) => this.rule(msg);

  /**
   * rule - decides whether a message received from the parent stream
   * should be forwarded to this stream's own receivers
   */
  protected abstract rule(msg: IMessage): void;

  override addReceiver(receiver: IReceiver): () => void {
    if (!this.hasReceivers) {
      this.parentStream?.addReceiver(this._boundRule);
    }
    return super.addReceiver(receiver);
  }

  override removeReceiver(receiver: IReceiver): void {
    super.removeReceiver(receiver);
    if (!this.hasReceivers) {
      this.parentStream?.removeReceiver(this._boundRule);
    }
  }
}

/**
 * MatchAllStream - a substream that forwards every message from its parent
 */
class MatchAllStream extends StreamFilter {
  protected rule(msg: IMessage): void {
    this.send(msg);
  }
}

/**
 * MatchLabelsStream - a substream that only forwards messages whose labels
 * match all of the labels it was created with
 */
class MatchLabelsStream extends StreamFilter {
  private readonly _labels: ILabels;

  constructor(parentStream: Stream, labels: ILabels = {}) {
    const safeLabels = labels ?? {};
    if (!Object.keys(safeLabels).length) {
      throw new Error('No labels were provided to matchLabels()');
    }
    super(parentStream);
    this._labels = safeLabels;
  }

  protected rule(msg: IMessage): void {
    if (Object.keys(this._labels).every((key) => this._labels[key] === msg.labels[key])) {
      this.send(msg);
    }
  }
}

/**
 * IMatchCondition - the condition a MatchConditionStream filters messages by
 */
interface IMatchCondition {
  key: string;
  operator: MatchConditionOperator;
  value: unknown;
}

/**
 * MatchConditionStream - a substream that only forwards messages whose
 * label at `condition.key` satisfies `condition.operator` against
 * `condition.value`
 */
class MatchConditionStream extends StreamFilter {
  private static readonly _operators: MatchConditionOperator[] = ['IN', 'NOT_IN', 'NOT'];

  private readonly _condition: IMatchCondition;

  constructor(parentStream: Stream, condition: IMatchCondition) {
    if (!MatchConditionStream._operators.includes(condition.operator)) {
      throw new Error('Invalid operator for matchCondition()');
    }
    super(parentStream);
    this._condition = condition;
  }

  protected rule(msg: IMessage): void {
    const values = Array.isArray(this._condition.value) ? this._condition.value : [this._condition.value];
    const labelValue = msg.labels[this._condition.key];

    let shouldSend = false;
    switch (this._condition.operator) {
      case 'IN':
        shouldSend = values.includes(labelValue);
        break;
      case 'NOT_IN':
        shouldSend = !values.includes(labelValue);
        break;
      case 'NOT':
        shouldSend = labelValue !== values[0];
        break;
    }

    if (shouldSend) {
      this.send(msg);
    }
  }
}


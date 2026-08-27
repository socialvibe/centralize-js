import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Stream } from '../stream.ts';
import type { ILabels, IMessage, MatchConditionOperator } from '../interfaces.ts';
import { DEFAULT_LOG_LEVELS } from '../logger.ts';

let stream: Stream;
let received: IMessage[];
const receiver = (msg: IMessage) => {
  received.push(msg);
};

beforeEach(() => {
  received = [];
  stream = new Stream();
});

describe('constructor', () => {
  it('accepts no parentStream, for a root stream', () => {
    assert.doesNotThrow(() => new Stream());
  });

  it('accepts a Stream as parentStream', () => {
    assert.doesNotThrow(() => new Stream(stream));
  });

  it('throws when given a non-Stream parentStream', () => {
    assert.throws(() => new Stream({} as unknown as Stream));
  });
});

it('sends every message to a registered receiver', () => {
  stream.addReceiver(receiver);
  const message: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' };
  const message2: IMessage = { logLevel: DEFAULT_LOG_LEVELS.error, labels: {}, value: 'bar' };

  stream.send(message);
  stream.send(message2);

  assert.deepEqual(received, [message, message2]);
});

describe('removeReceiver', () => {
  it('stops sending messages to a removed receiver', () => {
    stream.addReceiver(receiver);
    const message: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' };

    stream.send(message);
    assert.equal(received.length, 1);

    stream.removeReceiver(receiver);
    stream.send(message);
    assert.equal(received.length, 1);
  });
});

describe('addInterceptor', () => {
  it('calls the interceptor for every sent message', () => {
    let calls = 0;
    const interceptor = (msg: IMessage) => {
      calls++;
      return msg;
    };

    stream.addInterceptor(interceptor);
    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(calls, 1);
  });

  it('lets an interceptor modify a message before it reaches receivers', () => {
    stream.addReceiver(receiver);
    const interceptor = (msg: IMessage) => ({ ...msg, value: 'bar' });

    stream.addInterceptor(interceptor);
    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(received[0]?.value, 'bar');
  });

  it('does not call receivers when an interceptor returns null', () => {
    stream.addReceiver(receiver);
    stream.addInterceptor(() => null);

    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(received.length, 0);
  });

  it('does not call receivers when an interceptor returns undefined', () => {
    stream.addReceiver(receiver);
    stream.addInterceptor(() => undefined);

    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(received.length, 0);
  });

  it('stops running later interceptors once one returns null', () => {
    let secondCalls = 0;
    stream.addInterceptor(() => null);
    stream.addInterceptor((msg) => {
      secondCalls++;
      return msg;
    });

    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(secondCalls, 0);
  });

  it('stops running later interceptors once one returns undefined', () => {
    let secondCalls = 0;
    stream.addInterceptor(() => undefined);
    stream.addInterceptor((msg) => {
      secondCalls++;
      return msg;
    });

    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(secondCalls, 0);
  });

  it('ignores a non-object return value and keeps the previous message for later interceptors', () => {
    stream.addReceiver(receiver);
    // a JS caller unaware of the null/undefined convention might mistakenly
    // return false to mean "stop", which isn't part of the contract
    const interceptor = () => false as unknown as IMessage;
    stream.addInterceptor(interceptor);
    stream.addInterceptor((msg) => ({ ...msg, value: 'bar' }));

    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });

    assert.equal(received[0]?.value, 'bar');
  });
});

describe('removeInterceptor', () => {
  it('stops calling a removed interceptor', () => {
    let calls = 0;
    const interceptor = (msg: IMessage) => {
      calls++;
      return msg;
    };

    const remove = stream.addInterceptor(interceptor);
    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });
    assert.equal(calls, 1);

    remove();
    stream.send({ logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' });
    assert.equal(calls, 1);
  });
});

describe('logLevel', () => {
  it('only sends messages at or above the configured level', () => {
    stream.addReceiver(receiver);
    const message: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' };
    const message2: IMessage = { logLevel: DEFAULT_LOG_LEVELS.error, labels: {}, value: 'bar' };

    stream.logLevel = DEFAULT_LOG_LEVELS.error;
    stream.send(message);
    assert.equal(received.length, 0);

    stream.send(message2);
    assert.deepEqual(received, [message2]);
  });

  it('filters out a message whose logLevel is not an actual number', () => {
    stream.addReceiver(receiver);
    stream.logLevel = DEFAULT_LOG_LEVELS.error;

    // a non-TS caller could send a malformed logLevel
    const malformed = { logLevel: 'not-a-number', labels: {}, value: 'foo' } as unknown as IMessage;
    stream.send(malformed);

    assert.equal(received.length, 0);
  });

  it('reads back the configured level', () => {
    assert.equal(stream.logLevel, undefined);

    stream.logLevel = DEFAULT_LOG_LEVELS.error;

    assert.equal(stream.logLevel, DEFAULT_LOG_LEVELS.error);
  });
});

describe('matchAll', () => {
  it('sends every message to the substream', () => {
    stream.matchAll().addReceiver(receiver);
    const message: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' };
    const message2: IMessage = { logLevel: DEFAULT_LOG_LEVELS.error, labels: { app: 'foo' }, value: 'bar' };

    stream.send(message);
    stream.send(message2);

    assert.deepEqual(received, [message, message2]);
  });

  it('detaches from the parent stream once its last receiver is removed', (t) => {
    const removeReceiverSpy = t.mock.method(stream, 'removeReceiver');
    const remove = stream.matchAll().addReceiver(receiver);

    remove();

    assert.equal(removeReceiverSpy.mock.callCount(), 1);
  });

  it('does not attach to the parent stream until a receiver is added', (t) => {
    const addReceiverSpy = t.mock.method(stream, 'addReceiver');
    const substream = stream.matchAll();

    assert.equal(addReceiverSpy.mock.callCount(), 0);

    substream.addReceiver(receiver);
    assert.equal(addReceiverSpy.mock.callCount(), 1);
  });

  it('reattaches to the parent stream after a full detach', () => {
    const substream = stream.matchAll();
    const remove = substream.addReceiver(receiver);
    remove();

    substream.addReceiver(receiver);
    const message: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' };
    stream.send(message);

    assert.deepEqual(received, [message]);
  });
});

describe('matchLabels', () => {
  const labels: ILabels = { app: 'my-app' };
  const matching: ILabels = { app: 'my-app', foo: 'bar' };
  const notMatching: ILabels = { app: 'another-app', foo: 'bar' };

  it('only sends messages whose labels match all of the given labels', () => {
    const messageWithoutLabels: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: {}, value: 'foo' };
    const messageWithoutMatchingLabels: IMessage = {
      logLevel: DEFAULT_LOG_LEVELS.debug,
      labels: notMatching,
      value: 'foo',
    };
    const messageWithMatchingLabels: IMessage = {
      logLevel: DEFAULT_LOG_LEVELS.debug,
      labels: matching,
      value: 'foo',
    };

    const unsubscribe = stream.matchLabels(labels).addReceiver(receiver);

    stream.send(messageWithoutLabels);
    stream.send(messageWithoutMatchingLabels);
    assert.equal(received.length, 0);

    stream.send(messageWithMatchingLabels);
    assert.deepEqual(received, [messageWithMatchingLabels]);

    received = [];
    unsubscribe();
    stream.send(messageWithMatchingLabels);
    assert.equal(received.length, 0);
  });

  it('respects logLevel on a matched substream', () => {
    const messageWithMatchingLabels: IMessage = {
      logLevel: DEFAULT_LOG_LEVELS.debug,
      labels: matching,
      value: 'foo',
    };
    const substream = stream.matchLabels(labels);
    substream.logLevel = DEFAULT_LOG_LEVELS.error;
    substream.addReceiver(receiver);

    stream.send(messageWithMatchingLabels);
    assert.equal(received.length, 0);
  });

  it('throws when no labels are provided', () => {
    assert.throws(() => stream.matchLabels({}));
  });

  it('throws (instead of crashing) when labels is null', () => {
    assert.throws(() => stream.matchLabels(null as unknown as ILabels));
  });

  it('detaches from the parent stream once its last receiver is removed', (t) => {
    const removeReceiverSpy = t.mock.method(stream, 'removeReceiver');
    const remove = stream.matchLabels(labels).addReceiver(receiver);

    remove();

    assert.equal(removeReceiverSpy.mock.callCount(), 1);
  });

  it('does not attach to the parent stream until a receiver is added', (t) => {
    const addReceiverSpy = t.mock.method(stream, 'addReceiver');
    const substream = stream.matchLabels(labels);

    assert.equal(addReceiverSpy.mock.callCount(), 0);

    substream.addReceiver(receiver);
    assert.equal(addReceiverSpy.mock.callCount(), 1);
  });
});

describe('matchCondition', () => {
  const l1: ILabels = { app: 'my-app' };
  const l2: ILabels = { app: 'other-app' };
  const l3: ILabels = { app: 'not-specified' };
  const m1: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: l1, value: 'foo' };
  const m2: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: l2, value: 'foo' };
  const m3: IMessage = { logLevel: DEFAULT_LOG_LEVELS.debug, labels: l3, value: 'foo' };

  it('IN: only sends messages whose label value is in the given set', () => {
    stream.matchCondition('app', 'IN', ['my-app', 'other-app']).addReceiver(receiver);

    stream.send(m1);
    stream.send(m2);
    stream.send(m3);

    assert.deepEqual(received, [m1, m2]);
  });

  it('NOT_IN: only sends messages whose label value is not in the given set', () => {
    stream.matchCondition('app', 'NOT_IN', ['my-app', 'other-app']).addReceiver(receiver);

    stream.send(m1);
    stream.send(m2);
    stream.send(m3);

    assert.deepEqual(received, [m3]);
  });

  it('NOT: only sends messages whose label value is not the given value', () => {
    stream.matchCondition('app', 'NOT', 'my-app').addReceiver(receiver);

    stream.send(m1);
    stream.send(m2);
    stream.send(m3);

    assert.deepEqual(received, [m2, m3]);
  });

  it('throws when given an unknown operator', () => {
    assert.throws(() => stream.matchCondition('app', 'BAD' as MatchConditionOperator, 'my-app'));
  });

  it('accepts operators in any case', () => {
    stream.matchCondition('app', 'not', 'my-app').addReceiver(receiver);

    stream.send(m1);
    stream.send(m2);
    stream.send(m3);

    assert.deepEqual(received, [m2, m3]);
  });

  it('detaches from the parent stream once its last receiver is removed', (t) => {
    const removeReceiverSpy = t.mock.method(stream, 'removeReceiver');
    const remove = stream.matchCondition('app', 'IN', ['my-app']).addReceiver(receiver);

    remove();

    assert.equal(removeReceiverSpy.mock.callCount(), 1);
  });

  it('does not attach to the parent stream until a receiver is added', (t) => {
    const addReceiverSpy = t.mock.method(stream, 'addReceiver');
    const substream = stream.matchCondition('app', 'IN', ['my-app']);

    assert.equal(addReceiverSpy.mock.callCount(), 0);

    substream.addReceiver(receiver);
    assert.equal(addReceiverSpy.mock.callCount(), 1);
  });
});

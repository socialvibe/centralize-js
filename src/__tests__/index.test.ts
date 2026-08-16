import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import centralizeDefault, { Hub, Logger, LoggerClass, LOG_LEVELS, CreateMessage } from '../index.ts';
import type { IMessage } from '../index.ts';

describe('centralize', () => {
  describe('Hub', () => {
    it('sends messages to receivers subscribed on Hub.messages', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      Hub.send({ logLevel: LOG_LEVELS.info, labels: {}, value: 'hello' });

      assert.equal(received.length, 1);
      assert.equal(received[0]?.value, 'hello');

      unsubscribe();
    });

    it('fills in a timestamp on a copy, without mutating the original message', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      const original: IMessage = { logLevel: LOG_LEVELS.info, labels: {}, value: 'hi' };
      Hub.send(original);

      assert.equal(original.timestamp, undefined);
      assert.ok(received[0]?.timestamp instanceof Date);
      assert.notEqual(received[0], original);

      unsubscribe();
    });

    it('keeps an already-set timestamp as-is', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      const timestamp = new Date(2020, 0, 1);
      Hub.send({ logLevel: LOG_LEVELS.info, labels: {}, value: 'hi', timestamp });

      assert.equal(received[0]?.timestamp, timestamp);

      unsubscribe();
    });

    it('replaces a timestamp that is not an actual Date instance', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      // a non-TS caller could send a malformed timestamp
      const malformed = { logLevel: LOG_LEVELS.info, labels: {}, value: 'hi', timestamp: 'not-a-date' };
      Hub.send(malformed as unknown as IMessage);

      assert.ok(received[0]?.timestamp instanceof Date);

      unsubscribe();
    });

    it('defaults labels to an empty object when missing', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      // a non-TS caller could omit labels entirely
      const malformed = { logLevel: LOG_LEVELS.info, value: 'hi' };
      Hub.send(malformed as unknown as IMessage);

      assert.deepEqual(received[0]?.labels, {});

      unsubscribe();
    });
  });

  describe('Logger', () => {
    it('sends messages through the Hub using the default log levels', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      Logger.info('hello from logger');

      assert.equal(received.length, 1);
      assert.equal(received[0]?.logLevel, LOG_LEVELS.info);
      assert.equal(received[0]?.value, 'hello from logger');

      unsubscribe();
    });
  });

  describe('LoggerClass', () => {
    it('can create additional loggers that send through the Hub', () => {
      const received: IMessage[] = [];
      const unsubscribe = Hub.messages.addReceiver((msg) => received.push(msg));

      const custom = new LoggerClass(Hub, { critical: 100 });
      const methods = custom as unknown as { critical: (value: unknown) => void };
      methods.critical('bad!');

      assert.equal(received.length, 1);
      assert.equal(received[0]?.logLevel, 100);

      unsubscribe();
    });
  });

  describe('CreateMessage', () => {
    it('creates a message with the given log level and labels', () => {
      const message = CreateMessage(LOG_LEVELS.warn, { app: 'test' });

      assert.equal(message.logLevel, LOG_LEVELS.warn);
      assert.deepEqual(message.labels, { app: 'test' });
      assert.ok(message.timestamp instanceof Date);
    });
  });

  describe('default export', () => {
    it('is the same instance as the named Logger export', () => {
      assert.equal(centralizeDefault, Logger);
    });
  });
});

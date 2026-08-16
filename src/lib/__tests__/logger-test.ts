import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Logger, { createLogger } from '../logger.ts';
import type { ISender, IMessage, ILogLevels } from '../interfaces.ts';

/**
 * createSender - a test double ISender that records every message it's
 * sent
 */
function createSender(): { sender: ISender; sent: IMessage[] } {
  const sent: IMessage[] = [];
  const sender: ISender = {
    send: (msg: IMessage) => {
      sent.push(msg);
    },
  };
  return { sender, sent };
}

describe('Logger', () => {
  describe('constructor', () => {
    it('creates a typed logging method for each configured log level', () => {
      const levels = { foo: 1, bar: 2 };
      const { sender, sent } = createSender();
      const logger = createLogger(sender, levels);

      logger.foo('foo');
      assert.equal(sent.length, 1);
      assert.equal(sent[0]?.logLevel, levels.foo);
      assert.equal(sent[0]?.value, 'foo');
      assert.deepEqual(sent[0]?.labels, {});
      assert.ok(sent[0]?.timestamp instanceof Date);

      logger.bar('bar');
      assert.equal(sent[1]?.logLevel, levels.bar);
      assert.equal(sent[1]?.value, 'bar');
    });

    it('falls back to the default log levels when given null', () => {
      const { sender, sent } = createSender();
      const logger = new Logger(sender, null as unknown as ILogLevels);
      const methods = logger as unknown as { info: (value: unknown) => void };

      methods.info('hi');

      assert.equal(sent[0]?.logLevel, 30);
    });

    it('throws when a log level name collides with an existing Logger method', () => {
      const { sender } = createSender();

      assert.throws(() => new Logger<ILogLevels>(sender, { labels: 1 }));
    });
  });

  describe('createLogFunction', () => {
    it('creates a logging function that logs at a fixed level and labels', () => {
      const { sender, sent } = createSender();
      const logger = new Logger(sender, { foo: 1 });
      const myLabels = { app: 'myApp', tag: 'awesome' };
      const myLoggingFn = logger.createLogFunction(100, myLabels);

      myLoggingFn('wow');

      assert.equal(sent.length, 1);
      assert.equal(sent[0]?.logLevel, 100);
      assert.deepEqual(sent[0]?.labels, myLabels);
      assert.equal(sent[0]?.value, 'wow');
    });
  });

  describe('logLevels', () => {
    it('returns the log levels used to create the logger', () => {
      const { sender } = createSender();
      const levels = { foo: 1, bar: 2 };
      const logger = new Logger(sender, levels);

      assert.deepEqual(logger.logLevels, levels);
    });
  });

  describe('labels', () => {
    it('applies the default labels to every message a log-level method sends', () => {
      const { sender, sent } = createSender();
      const logger = createLogger(sender, { foo: 1 });

      logger.labels = { app: 'awesome' };
      logger.foo('message');

      assert.equal(sent[0]?.labels['app'], 'awesome');
      assert.deepEqual(logger.labels, { app: 'awesome' });
    });
  });
});

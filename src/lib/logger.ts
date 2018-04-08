import {ILogLevels, ISender, IMessage} from './interfaces';

// helper for creating messages
/* istanbul ignore next */
function createMessage(logLevel=DEFAULT_LOG_LEVELS.log, labels={}) : IMessage {
  return {
    logLevel,
    labels,
    value: '',
    timestamp: new Date()
  };
}

// standard log levels (corresponds to functions on console)
export const DEFAULT_LOG_LEVELS: ILogLevels = {
  debug: 10,
  log: 20,
  info: 30,
  warn: 40,
  error: 50,
};

// Logger Class
export default class Logger {
  /**
   * constructor
   * @param {object} sender - object contains send(msg: IMessage)
   * @param {object} logLevels - object containing (levelName:number)
   */
  constructor(private _sender: ISender , logLevels: ILogLevels) {
    Object.keys(logLevels).forEach((k) => {
      this[k] = (val: any, labels={}) => {
        const logLevel = logLevels[k];
        const message = createMessage(logLevel, labels);
        message.value = val;
        this._sender.send(message);
      }
    });
  }

  /**
   * Create a new logging function
   * @param {number} logLevel - the log level this function will log at
   * @param {object} labels - the labels to automatically add to the logged message
   * @returns {function} logFn - the logging function
   */
  createLogFunction(logLevel: number, labels={}) {
    return (val: any) => {
      const message = createMessage(logLevel, labels);
      message.value = val;
      this._sender.send(message);
    };
  }
}
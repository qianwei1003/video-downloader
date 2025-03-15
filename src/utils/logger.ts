type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

class Logger {
  private _level: LogLevel = 'info';
  private _prefix: string = '';
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options?: LoggerOptions) {
    if (options?.level) {
      this._level = options.level;
    }
    
    if (options?.prefix) {
      this._prefix = options.prefix;
    }
  }

  setLevel(level: LogLevel) {
    this._level = level;
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${this._prefix}${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${this._prefix}${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${this._prefix}${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${this._prefix}${message}`, ...args);
    }
  }

  getLevel(): LogLevel {
    return this._level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this._level];
  }
}

export const logger = new Logger();

export function initLogger(level?: LogLevel) {
  if (level) {
    logger.setLevel(level);
  } else if (process.env.LOG_LEVEL) {
    logger.setLevel(process.env.LOG_LEVEL as LogLevel);
  }
}

// 添加 getLogger 函数以兼容现有代码
export function getLogger(prefix?: string): Logger {
  return new Logger({ level: logger.getLevel(), prefix: prefix ? `[${prefix}] ` : '' });
}

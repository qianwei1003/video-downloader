import { appendFileSync } from 'fs';
import { join } from 'path';

export interface ILogger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export class Logger implements ILogger {
  private logFile: string;

  constructor() {
    this.logFile = join(process.cwd(), 'app.log');
  }

  private formatMessage(level: string, message: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ') : '';
    
    return `[${timestamp}] ${level}: ${message}${argsStr}\n`;
  }

  private writeToFile(message: string) {
    try {
      appendFileSync(this.logFile, message);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message: string, ...args: any[]) {
    const formattedMessage = this.formatMessage('INFO', message, args);
    console.log('\x1b[32m%s\x1b[0m', message, ...args); // 绿色
    this.writeToFile(formattedMessage);
  }

  error(message: string, ...args: any[]) {
    const formattedMessage = this.formatMessage('ERROR', message, args);
    console.error('\x1b[31m%s\x1b[0m', message, ...args); // 红色
    this.writeToFile(formattedMessage);
  }

  warn(message: string, ...args: any[]) {
    const formattedMessage = this.formatMessage('WARN', message, args);
    console.warn('\x1b[33m%s\x1b[0m', message, ...args); // 黄色
    this.writeToFile(formattedMessage);
  }

  debug(message: string, ...args: any[]) {
    const formattedMessage = this.formatMessage('DEBUG', message, args);
    console.debug('\x1b[36m%s\x1b[0m', message, ...args); // 青色
    this.writeToFile(formattedMessage);
  }
}

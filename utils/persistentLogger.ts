/**
 * Persistent Logger
 * Stores logs in AsyncStorage with rolling buffer (last ~200 entries)
 * Works in Preview builds without Xcode
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_STORAGE_KEY = '@execudex:debug_logs';
const MAX_LOG_ENTRIES = 200;

export interface LogEntry {
  timestamp: number;
  eventName: string;
  data?: any;
  level?: 'info' | 'warn' | 'error' | 'checkpoint';
}

class PersistentLogger {
  private logs: LogEntry[] = [];
  private isInitialized = false;

  /**
   * Initialize logger - load existing logs from storage
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
        // Ensure we don't exceed max entries
        if (this.logs.length > MAX_LOG_ENTRIES) {
          this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
          await this.save();
        }
      }
      this.isInitialized = true;
      this.log('logger', { action: 'initialized', entryCount: this.logs.length });
    } catch (error) {
      console.error('[PersistentLogger] Init error:', error);
      this.logs = [];
      this.isInitialized = true;
    }
  }

  /**
   * Log an event
   */
  async log(eventName: string, data?: any, level: LogEntry['level'] = 'info'): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      eventName,
      data: this.sanitizeData(data),
      level,
    };

    // Add to memory
    this.logs.push(entry);

    // Keep only last N entries
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }

    // Also log to console for immediate visibility
    const prefix = `[${level.toUpperCase()}]`;
    console.log(`${prefix} [${eventName}]`, data || '');

    // Save to storage (async, don't wait)
    this.save().catch((error) => {
      console.error('[PersistentLogger] Save error:', error);
    });
  }

  /**
   * Log a checkpoint (special type of log)
   */
  async checkpoint(eventName: string, data?: any): Promise<void> {
    await this.log(eventName, data, 'checkpoint');
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get last N logs
   */
  getLastLogs(count: number): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  async clear(): Promise<void> {
    this.logs = [];
    await AsyncStorage.removeItem(LOG_STORAGE_KEY);
    await this.log('logger', { action: 'cleared' });
  }

  /**
   * Export logs as formatted text
   */
  exportAsText(): string {
    return this.logs
      .map((entry) => {
        const time = new Date(entry.timestamp).toISOString();
        const level = entry.level?.toUpperCase().padEnd(8) || 'INFO    ';
        const dataStr = entry.data ? JSON.stringify(entry.data, null, 2) : '';
        return `[${time}] ${level} [${entry.eventName}] ${dataStr}`;
      })
      .join('\n\n');
  }

  /**
   * Export logs as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Save logs to storage
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('[PersistentLogger] Save error:', error);
    }
  }

  /**
   * Sanitize data for storage (remove circular refs, limit size)
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    try {
      const str = JSON.stringify(data);
      if (str.length > 1000) {
        return { _truncated: true, _length: str.length, preview: str.substring(0, 1000) };
      }
      return data;
    } catch {
      return { _stringifyError: true, type: typeof data };
    }
  }
}

export const persistentLogger = new PersistentLogger();

// Initialize on module load
persistentLogger.init().catch(console.error);

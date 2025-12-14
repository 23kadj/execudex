/**
 * Native Call Debugger
 * Tracks and logs all native module calls to help identify crash sources
 */

import { persistentLogger } from './persistentLogger';

type NativeCallType = 'haptics' | 'linking' | 'router' | 'supabase' | 'other';

interface NativeCallLog {
  timestamp: number;
  type: NativeCallType;
  method: string;
  params: any;
  success: boolean;
  error?: any;
  stack?: string;
}

class NativeCallDebugger {
  private logs: NativeCallLog[] = [];
  private maxLogs = 100;
  
  // Feature flags to disable suspect native calls
  private flags = {
    disableHaptics: false,
    disableLinking: false,
    disableRouter: false,
    disableSupabase: false,
  };

  /**
   * Log a native module call
   */
  logCall(
    type: NativeCallType,
    method: string,
    params: any,
    success: boolean,
    error?: any
  ): void {
    const log: NativeCallLog = {
      timestamp: Date.now(),
      type,
      method,
      params: this.sanitizeParams(params),
      success,
      error: error ? this.sanitizeError(error) : undefined,
      stack: new Error().stack,
    };

    this.logs.push(log);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console logging with clear markers
    const status = success ? '✅' : '❌';
    console.log(`[NATIVE_CALL] ${status} ${type}.${method}`, {
      params: log.params,
      success,
      error: log.error,
      timestamp: new Date(log.timestamp).toISOString(),
    });

    // Also log to persistent logger
    persistentLogger.log(
      `native:${type}:${method}`,
      { success, params: log.params, error: log.error },
      success ? 'info' : 'error'
    );

    if (!success && error) {
      console.error(`[NATIVE_CALL_ERROR] ${type}.${method}:`, error);
    }
  }

  /**
   * Sanitize params for logging (remove sensitive data, limit size)
   */
  sanitizeParams(params: any): any {
    if (!params) return params;
    
    try {
      const str = JSON.stringify(params);
      if (str.length > 500) {
        return { _truncated: true, _length: str.length, preview: str.substring(0, 500) };
      }
      return params;
    } catch {
      return { _stringifyError: true };
    }
  }

  /**
   * Sanitize error for logging
   */
  sanitizeError(error: any): any {
    if (!error) return error;
    
    try {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        };
      }
      return String(error);
    } catch {
      return { _error: 'Could not serialize error' };
    }
  }

  /**
   * Get all logs
   */
  getLogs(): NativeCallLog[] {
    return [...this.logs];
  }

  /**
   * Get logs for a specific type
   */
  getLogsByType(type: NativeCallType): NativeCallLog[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * Get last N logs
   */
  getLastLogs(count: number): NativeCallLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Set a feature flag
   */
  setFlag(flag: keyof typeof this.flags, value: boolean): void {
    this.flags[flag] = value;
    console.log(`[NATIVE_DEBUG] Flag ${flag} set to ${value}`);
  }

  /**
   * Get a feature flag
   */
  getFlag(flag: keyof typeof this.flags): boolean {
    return this.flags[flag];
  }

  /**
   * Check if a native call type should be disabled
   */
  isDisabled(type: NativeCallType): boolean {
    switch (type) {
      case 'haptics':
        return this.flags.disableHaptics;
      case 'linking':
        return this.flags.disableLinking;
      case 'router':
        return this.flags.disableRouter;
      case 'supabase':
        return this.flags.disableSupabase;
      default:
        return false;
    }
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    try {
      return JSON.stringify(this.logs, null, 2);
    } catch {
      return '[]';
    }
  }
}

export const nativeCallDebugger = new NativeCallDebugger();

/**
 * Wrapper for native module calls with logging and error handling
 */
export async function safeNativeCall<T>(
  type: NativeCallType,
  method: string,
  params: any,
  callFn: () => Promise<T> | T
): Promise<T | null> {
  // Check if this call type is disabled
  if (nativeCallDebugger.isDisabled(type)) {
    console.log(`[NATIVE_DEBUG] ${type}.${method} DISABLED by flag`);
    persistentLogger.log(`native:${type}:${method}:disabled`, { params: nativeCallDebugger.sanitizeParams(params) });
    return null;
  }

  // Log before native call
  persistentLogger.log(`native:${type}:${method}:before`, { params: nativeCallDebugger.sanitizeParams(params) }, 'checkpoint');

  try {
    const result = await Promise.resolve(callFn());
    nativeCallDebugger.logCall(type, method, params, true);
    // Log after success
    persistentLogger.log(`native:${type}:${method}:success`, { params: nativeCallDebugger.sanitizeParams(params) }, 'info');
    return result;
  } catch (error: any) {
    // For Supabase queries, handle errors gracefully to prevent TurboModule crashes
    if (type === 'supabase' && error?.code === 'PGRST116') {
      // PGRST116 = no rows returned - this is expected, not an error
      console.log(`[NATIVE_CALL] ${type}.${method} - No rows found (expected)`);
      nativeCallDebugger.logCall(type, method, params, true); // Log as success since it's expected
      persistentLogger.log(`native:${type}:${method}:no-rows`, { params: nativeCallDebugger.sanitizeParams(params) }, 'info');
      return null;
    }
    
    // Sanitize error before logging to prevent issues with error conversion
    const sanitizedError = nativeCallDebugger.sanitizeError(error);
    nativeCallDebugger.logCall(type, method, params, false, sanitizedError);
    
    // Log failure
    persistentLogger.log(`native:${type}:${method}:failure`, { 
      params: nativeCallDebugger.sanitizeParams(params),
      error: sanitizedError
    }, 'error');
    
    // For Supabase errors in preview builds, return null instead of throwing
    // to prevent TurboModule error conversion crashes
    if (type === 'supabase') {
      console.error(`[NATIVE_CALL] Supabase error in ${method}:`, sanitizedError);
      return null;
    }
    
    // For other errors, still throw but with sanitized error
    throw error;
  }
}

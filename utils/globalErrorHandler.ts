/**
 * Global Error Handler
 * Catches unhandled errors and promise rejections to prevent crashes
 */


interface ErrorLog {
  timestamp: number;
  type: 'error' | 'promiseRejection';
  error: any;
  stack?: string;
  context?: any;
}

class GlobalErrorHandler {
  private errorLogs: ErrorLog[] = [];
  private maxLogs = 50;
  private originalHandler: ((error: Error, isFatal?: boolean) => void) | null = null;
  private onScreenOverlay: ((error: ErrorLog) => void) | null = null;

  /**
   * Initialize global error handlers
   */
  init(): void {
    // Store original handler
    this.originalHandler = ErrorUtils.getGlobalHandler();

    // Set up error handler
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      this.handleError(error, isFatal);
    });

    // Set up unhandled promise rejection handler
    if (typeof global !== 'undefined') {
      const originalUnhandledRejection = (global as any).onunhandledrejection;
      
      (global as any).onunhandledrejection = (event: PromiseRejectionEvent) => {
        this.handlePromiseRejection(event);
        if (originalUnhandledRejection) {
          originalUnhandledRejection(event);
        }
      };
    }

    console.log('[GLOBAL_ERROR_HANDLER] Initialized');
  }

  /**
   * Handle JavaScript errors
   */
  private handleError(error: Error, isFatal?: boolean): void {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      stack: error.stack,
    };

    this.logError(errorLog);

    // Log to console with clear markers
    console.error('========================================');
    console.error('[FATAL_ERROR]', isFatal ? 'FATAL' : 'NON-FATAL');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Timestamp:', new Date(errorLog.timestamp).toISOString());
    console.error('========================================');

    // Show on-screen overlay if available
    if (this.onScreenOverlay) {
      this.onScreenOverlay(errorLog);
    }

    // Call original handler if it exists
    if (this.originalHandler) {
      this.originalHandler(error, isFatal);
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  private handlePromiseRejection(event: PromiseRejectionEvent): void {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      type: 'promiseRejection',
      error: event.reason,
      stack: event.reason?.stack,
    };

    this.logError(errorLog);

    // Log to console with clear markers
    console.error('========================================');
    console.error('[UNHANDLED_PROMISE_REJECTION]');
    console.error('Reason:', event.reason);
    if (event.reason?.stack) {
      console.error('Stack:', event.reason.stack);
    }
    console.error('Timestamp:', new Date(errorLog.timestamp).toISOString());
    console.error('========================================');

    // Show on-screen overlay if available
    if (this.onScreenOverlay) {
      this.onScreenOverlay(errorLog);
    }
  }

  /**
   * Log an error
   */
  private logError(errorLog: ErrorLog): void {
    this.errorLogs.push(errorLog);
    
    // Keep only last N logs
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs.shift();
    }
  }

  /**
   * Get all error logs
   */
  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  /**
   * Get last error log
   */
  getLastError(): ErrorLog | null {
    return this.errorLogs.length > 0 ? this.errorLogs[this.errorLogs.length - 1] : null;
  }

  /**
   * Clear all error logs
   */
  clearErrorLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Set callback for on-screen overlay
   */
  setOnScreenOverlay(callback: (error: ErrorLog) => void): void {
    this.onScreenOverlay = callback;
  }

  /**
   * Export error logs as JSON
   */
  exportErrorLogs(): string {
    try {
      return JSON.stringify(this.errorLogs, null, 2);
    } catch {
      return '[]';
    }
  }
}

export const globalErrorHandler = new GlobalErrorHandler();

/**
 * Initialize global error handler (call this early in app startup)
 */
export function initGlobalErrorHandler(): void {
  globalErrorHandler.init();
}









/**
 * Diagnostic Logger for Profile Pipeline
 * 
 * Enables comprehensive tracing of profile processing flow.
 * All logging is gated behind DEBUG_PROFILE_PIPELINE flag.
 */

// Use EXPO_PUBLIC_ prefix for Expo environment variables
export const DEBUG_PROFILE_PIPELINE = process.env.EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE === 'true';

/**
 * Generate unique trace ID for correlating related operations
 */
export function newTraceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Log diagnostic information with timestamp and optional trace ID
 */
export function logDiag(tag: string, data?: unknown, trace?: string): void {
  if (!DEBUG_PROFILE_PIPELINE) return;
  
  const ts = new Date().toISOString();
  const traceStr = trace ? ` [${trace}]` : '';
  
  // eslint-disable-next-line no-console
  console.log(`[diag ${ts}] ${tag}${traceStr}`, data ?? '');
}

/**
 * Log error with stack trace
 */
export function logDiagError(tag: string, error: unknown, trace?: string): void {
  if (!DEBUG_PROFILE_PIPELINE) return;
  
  const ts = new Date().toISOString();
  const traceStr = trace ? ` [${trace}]` : '';
  
  // eslint-disable-next-line no-console
  console.error(`[diag ${ts}] ERROR:${tag}${traceStr}`, error);
}

/**
 * Create a performance marker
 */
export function logDiagPerf(tag: string, startTime: number, trace?: string): void {
  if (!DEBUG_PROFILE_PIPELINE) return;
  
  const duration = Date.now() - startTime;
  logDiag(`perf:${tag}`, { durationMs: duration }, trace);
}



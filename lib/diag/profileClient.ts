/**
 * Diagnostic Profile Processing Client
 * 
 * Wraps profile processing calls with:
 * - Mutex/serialization per profile key
 * - Request/response logging
 * - Timeout handling
 * - Correlation via trace IDs
 */

import { logDiag, logDiagError } from './logger';

// In-memory locks to prevent concurrent processing of same profile
const locks = new Map<string, Promise<unknown>>();

/**
 * Generate lock key for profile
 */
function lockKey(isPpl: boolean, id: number): string {
  return `${isPpl ? 'p' : 'l'}:${id}`;
}

export interface ProfileProcessResult {
  ok: boolean;
  status: number;
  text: string;
  error?: string;
}

/**
 * POST to profile processing endpoint with mutex and diagnostics
 * 
 * @param url - Edge function URL
 * @param id - Profile ID
 * @param isPpl - true for politician, false for legislation
 * @param trace - Trace ID for correlation
 * @param timeoutMs - Request timeout (default 30s)
 */
export async function postProfileProcess(
  url: string,
  id: number,
  isPpl: boolean,
  trace: string,
  timeoutMs: number = 30000
): Promise<ProfileProcessResult> {
  const key = lockKey(isPpl, id);
  const startTime = Date.now();
  
  // Wait for any existing operation on this profile
  const prev = locks.get(key) ?? Promise.resolve();
  
  // Create new lock promise
  let release!: (v?: unknown) => void;
  const next = new Promise(res => (release = res));
  locks.set(key, prev.then(() => next));
  
  try {
    // Wait for previous operation
    await prev;
    
    logDiag('client:request:start', {
      key,
      url,
      id,
      isPpl,
      queueWaitMs: Date.now() - startTime
    }, trace);
    
    const requestStartTime = Date.now();
    
    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': trace
        },
        body: JSON.stringify({ id, is_ppl: isPpl }),
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        logDiagError('client:request:timeout', {
          key,
          url,
          timeoutMs,
          elapsedMs: Date.now() - requestStartTime
        }, trace);
        
        return {
          ok: false,
          status: 0,
          text: '',
          error: 'Request timeout'
        };
      }
      
      logDiagError('client:request:fetch-error', {
        key,
        url,
        error: fetchError.message
      }, trace);
      
      return {
        ok: false,
        status: 0,
        text: '',
        error: fetchError.message
      };
    }
    
    clearTimeout(timeoutId);
    
    // Read response body
    let text = '';
    try {
      text = await response.text();
    } catch (readError) {
      logDiagError('client:request:read-error', readError, trace);
    }
    
    const requestDurationMs = Date.now() - requestStartTime;
    
    logDiag('client:request:complete', {
      key,
      url,
      status: response.status,
      ok: response.ok,
      bodyLength: text.length,
      bodyPreview: text.slice(0, 400),
      durationMs: requestDurationMs
    }, trace);
    
    return {
      ok: response.ok,
      status: response.status,
      text
    };
    
  } catch (error: any) {
    logDiagError('client:request:unexpected-error', error, trace);
    
    return {
      ok: false,
      status: 0,
      text: '',
      error: error.message || String(error)
    };
    
  } finally {
    // Release lock
    release();
    
    // Clean up if we're the current lock holder
    if (locks.get(key) === next) {
      locks.delete(key);
    }
    
    const totalDurationMs = Date.now() - startTime;
    logDiag('client:operation:complete', {
      key,
      totalDurationMs
    }, trace);
  }
}

/**
 * Get current lock status (for diagnostics)
 */
export function getLockStatus(isPpl: boolean, id: number): {
  key: string;
  isLocked: boolean;
} {
  const key = lockKey(isPpl, id);
  return {
    key,
    isLocked: locks.has(key)
  };
}



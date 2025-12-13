// Lazy-load AsyncStorage to prevent crashes in preview/release builds
// AsyncStorage is only loaded when functions are called, not at module scope

const STARTUP_LOG_KEY = '@execudex:startup_log';
const MAX_LOG_ENTRIES = 100; // Prevent unbounded growth

/**
 * Lazy-load AsyncStorage module
 */
async function getAsyncStorage() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage;
}

/**
 * Logs a startup milestone with timestamp
 */
export async function logStartup(message: string): Promise<void> {
  try {
    const AsyncStorage = await getAsyncStorage();
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Get existing log
    const existingLog = await AsyncStorage.getItem(STARTUP_LOG_KEY);
    const logLines = existingLog ? existingLog.split('\n').filter(Boolean) : [];
    
    // Add new entry
    logLines.push(logEntry);
    
    // Keep only the most recent entries
    if (logLines.length > MAX_LOG_ENTRIES) {
      logLines.splice(0, logLines.length - MAX_LOG_ENTRIES);
    }
    
    // Save back to AsyncStorage
    await AsyncStorage.setItem(STARTUP_LOG_KEY, logLines.join('\n'));
    
    // Also log to console for immediate visibility
    console.log(`[StartupLog] ${logEntry}`);
  } catch (error) {
    console.error('[StartupLogger] Failed to log startup message:', error);
  }
}

/**
 * Retrieves the startup log
 */
export async function getStartupLog(): Promise<string> {
  try {
    const AsyncStorage = await getAsyncStorage();
    const log = await AsyncStorage.getItem(STARTUP_LOG_KEY);
    return log || 'No startup log entries found.';
  } catch (error) {
    console.error('[StartupLogger] Failed to get startup log:', error);
    return `Error retrieving startup log: ${error}`;
  }
}

/**
 * Clears the startup log
 */
export async function clearStartupLog(): Promise<void> {
  try {
    const AsyncStorage = await getAsyncStorage();
    await AsyncStorage.removeItem(STARTUP_LOG_KEY);
    console.log('[StartupLogger] Startup log cleared');
  } catch (error) {
    console.error('[StartupLogger] Failed to clear startup log:', error);
    throw error;
  }
}

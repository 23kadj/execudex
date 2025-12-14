/**
 * Debug Flags
 * Centralized location to toggle native module calls for crash isolation
 * Persists to AsyncStorage and loads on app startup
 * 
 * Usage:
 *   import { debugFlags } from '../utils/debugFlags';
 *   if (!debugFlags.disableHaptics) {
 *     // Make haptics call
 *   }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nativeCallDebugger } from './nativeCallDebugger';

const FLAGS_STORAGE_KEY = '@execudex:debug_flags';

interface DebugFlagsState {
  disableHaptics: boolean;
  disableLinking: boolean;
  disableRouter: boolean;
  disableSupabase: boolean;
}

class DebugFlagsManager {
  private flags: DebugFlagsState = {
    disableHaptics: false,
    disableLinking: false,
    disableRouter: false,
    disableSupabase: false,
  };
  private isInitialized = false;

  /**
   * Initialize flags - load from AsyncStorage
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(FLAGS_STORAGE_KEY);
      if (stored) {
        const loadedFlags = JSON.parse(stored);
        this.flags = { ...this.flags, ...loadedFlags };
        
        // Sync with nativeCallDebugger
        nativeCallDebugger.setFlag('disableHaptics', this.flags.disableHaptics);
        nativeCallDebugger.setFlag('disableLinking', this.flags.disableLinking);
        nativeCallDebugger.setFlag('disableRouter', this.flags.disableRouter);
        nativeCallDebugger.setFlag('disableSupabase', this.flags.disableSupabase);
        
        console.log('[DebugFlags] Loaded from storage:', this.flags);
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('[DebugFlags] Init error:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Save flags to AsyncStorage
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(this.flags));
    } catch (error) {
      console.error('[DebugFlags] Save error:', error);
    }
  }

  /**
   * Get a flag value
   */
  getFlag(key: keyof DebugFlagsState): boolean {
    return this.flags[key];
  }

  /**
   * Set a flag value and persist
   */
  async setFlag(key: keyof DebugFlagsState, value: boolean): Promise<void> {
    this.flags[key] = value;
    
    // Sync with nativeCallDebugger
    nativeCallDebugger.setFlag(key, value);
    
    // Persist to storage
    await this.save();
    
    console.log(`[DebugFlags] ${key} set to ${value}`);
  }

  /**
   * Get all flags
   */
  getAllFlags(): DebugFlagsState {
    return { ...this.flags };
  }

  /**
   * Reset all flags to false
   */
  async resetAll(): Promise<void> {
    this.flags = {
      disableHaptics: false,
      disableLinking: false,
      disableRouter: false,
      disableSupabase: false,
    };
    
    // Sync with nativeCallDebugger
    Object.keys(this.flags).forEach((key) => {
      nativeCallDebugger.setFlag(key as keyof DebugFlagsState, false);
    });
    
    await this.save();
    console.log('[DebugFlags] All flags reset');
  }
}

const flagsManager = new DebugFlagsManager();

// Initialize on module load
flagsManager.init().catch(console.error);

/**
 * Initialize debug flags (can be called explicitly if needed)
 */
export async function initDebugFlags(): Promise<void> {
  await flagsManager.init();
}

export const debugFlags = {
  /**
   * Disable all haptics calls
   */
  get disableHaptics() {
    return flagsManager.getFlag('disableHaptics');
  },
  set disableHaptics(value: boolean) {
    flagsManager.setFlag('disableHaptics', value).catch(console.error);
  },

  /**
   * Disable all Linking calls (canOpenURL, openURL)
   */
  get disableLinking() {
    return flagsManager.getFlag('disableLinking');
  },
  set disableLinking(value: boolean) {
    flagsManager.setFlag('disableLinking', value).catch(console.error);
  },

  /**
   * Disable router navigation calls
   */
  get disableRouter() {
    return flagsManager.getFlag('disableRouter');
  },
  set disableRouter(value: boolean) {
    flagsManager.setFlag('disableRouter', value).catch(console.error);
  },

  /**
   * Disable Supabase calls
   */
  get disableSupabase() {
    return flagsManager.getFlag('disableSupabase');
  },
  set disableSupabase(value: boolean) {
    flagsManager.setFlag('disableSupabase', value).catch(console.error);
  },
};

/**
 * Helper to log current flag states
 */
export function logDebugFlags(): void {
  console.log('[DEBUG_FLAGS] Current state:', flagsManager.getAllFlags());
}

/**
 * Reset all flags to false
 */
export async function resetDebugFlags(): Promise<void> {
  await flagsManager.resetAll();
}

/**
 * Get all flags (for UI display)
 */
export function getAllDebugFlags(): DebugFlagsState {
  return flagsManager.getAllFlags();
}

/**
 * Set a flag (async, for UI)
 */
export async function setDebugFlag(key: keyof DebugFlagsState, value: boolean): Promise<void> {
  await flagsManager.setFlag(key, value);
}

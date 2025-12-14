// Debug flags for runtime crash testing
// Stored in AsyncStorage for persistence across app restarts

let textInputsDisabled: boolean | null = null;

/**
 * Check if TextInputs should be disabled (for iOS crash testing)
 * Uses lazy-loaded AsyncStorage to avoid top-level native imports
 */
export async function areTextInputsDisabled(): Promise<boolean> {
  if (textInputsDisabled !== null) {
    return textInputsDisabled;
  }
  
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const value = await AsyncStorage.getItem('@execudex:debug_disable_textinputs');
    textInputsDisabled = value === 'true';
    return textInputsDisabled;
  } catch (error) {
    console.error('Error reading debug flag:', error);
    return false;
  }
}

/**
 * Set whether TextInputs should be disabled
 */
export async function setTextInputsDisabled(disabled: boolean): Promise<void> {
  textInputsDisabled = disabled;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('@execudex:debug_disable_textinputs', disabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving debug flag:', error);
  }
}


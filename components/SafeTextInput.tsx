// Safe TextInput wrapper that respects debug flags and ensures string values
import React, { useEffect, useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { areTextInputsDisabled } from '../utils/debugFlags';

interface SafeTextInputProps extends TextInputProps {
  // All TextInput props are passed through
}

export const SafeTextInput = React.forwardRef<TextInput, SafeTextInputProps>(
  ({ value, placeholder, ...props }, ref) => {
    const [inputsDisabled, setInputsDisabled] = useState(false);

    useEffect(() => {
      areTextInputsDisabled().then(set => setInputsDisabled(set));
    }, []);

    // Ensure value is always a string
    const safeValue = String(value ?? '');
    const safePlaceholder = String(placeholder ?? '');

    // If debug flag is enabled, render as non-interactive text
    if (inputsDisabled) {
      return (
        <View style={[{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 }, props.style]}>
          <Text style={{ color: '#666' }}>
            {safeValue || safePlaceholder || 'TextInput disabled (debug)'}
          </Text>
        </View>
      );
    }

    // Normal TextInput with safe string values
    return (
      <TextInput
        ref={ref}
        {...props}
        value={safeValue}
        placeholder={safePlaceholder}
      />
    );
  }
);

SafeTextInput.displayName = 'SafeTextInput';


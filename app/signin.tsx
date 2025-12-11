import React from 'react';
import { StyleSheet, View } from 'react-native';
import SignInScreen from '../components/SignInScreen';

export default function SignInPage() {
  return (
    <View style={styles.container}>
      <SignInScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

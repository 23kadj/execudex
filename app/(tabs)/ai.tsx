// app/tabs/home.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function () {
  return (
    <View style={styles.container}>
      {/* ← your real Home screen here */}
      <Text style={{ color: '#fff' }}>Welcome to Home!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    // content will appear above the tab bar
  },
});

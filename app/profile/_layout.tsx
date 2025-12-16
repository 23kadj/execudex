import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import React from 'react';

// #region agent log - profile layout entry
try {
  Sentry.addBreadcrumb({ category: 'router', message: 'Mounted /profile/_layout', level: 'info' });
} catch {}
// #endregion

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

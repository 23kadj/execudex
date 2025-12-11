import { Tabs } from 'expo-router';
import React from 'react';
import CustomTabBar from './_TabBar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // ⬇️ this replaces the entire bottom bar
      tabBar={(props) => <CustomTabBar {...props} />}
    />
  );
}

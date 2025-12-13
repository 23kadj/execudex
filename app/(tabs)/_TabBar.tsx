import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View
} from 'react-native';


const ICONS: Record<string, { active: any; inactive: any }> = {
  home: {
    active:   require('../../assets/home1.png'),
    inactive: require('../../assets/home2.png'),
  },
  exp1: {
    active:   require('../../assets/explore1.png'),
    inactive: require('../../assets/explore2.png'),
  },
  profile: {
    active:   require('../../assets/profile1.png'),
    inactive: require('../../assets/profile2.png'),
  },
};

export default function CustomTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  // only keep routes that we have icons for:
 // only keep routes in the exact order we want:
 const desiredOrder = ['home', 'exp1', 'profile'];
 const visibleRoutes = desiredOrder
   .map(name => state.routes.find(r => r.name === name))
   .filter(Boolean);


  return (
    <View style={styles.tabBar}>
      {visibleRoutes.map((route, idx) => {
        const focused = state.index === state.routes.indexOf(route);
        const onPress = () => {
          Haptics.selectionAsync();
          navigation.navigate(route.name);
        };

        const asset   = ICONS[route.name]![focused ? 'active' : 'inactive'];

        return (
        <Pressable
          key={route.key}
          onPress={onPress}
          style={styles.iconWrap}
        >
          <Image source={asset} style={styles.icon} />
        </Pressable>

        );
      })}
    </View>
  );
}
const ICON_SIZE = 100;
const styles = StyleSheet.create({
  tabBar: {
    position:       'absolute',
    bottom:         0,
    alignSelf:      'center',
    width:          '110%',
    height:         '9%',
    backgroundColor:'rgba(0, 0, 0, 1)',
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 50,   // optional: adds a bit of inset on the sides

  },
  iconWrap: {
    width:         50,
    height:        50,
    alignItems:    'center',
    justifyContent:'center',
  },

  icon: {
    width:        25,
    height:       25,
    resizeMode:  'contain',
    bottom:      10,
  },
});

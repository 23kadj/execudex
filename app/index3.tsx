import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { memo, useMemo } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { useLegiWeak } from '../hooks/useLegiWeak';

// Import the new legislation components
import Legi1 from './legislation/legi1';
import Legi2 from './legislation/legi2';
import Legi3 from './legislation/legi3';
import Overview from './legislation/overview';

const TABS = [
  { label: 'Overview',  key: 'overview',   component: Overview  },
  { label: 'Agenda',    key: 'legi1',      component: Legi1     },
  { label: 'Impact',    key: 'legi2',      component: Legi2     },
  { label: 'Discourse', key: 'legi3',      component: Legi3     },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Index3({ navigation }: { navigation?: any }) {
  const params = useLocalSearchParams<{ index?: string }>();
  const legislationId = useMemo(() => (typeof params.index === "string" ? params.index : ""), [params.index]);
  const { isWeak, isLoading } = useLegiWeak(legislationId);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // 🔒 WEAK MODE: render a minimal, one-page layout (no tabs, no scroll, no footer)
  if (isWeak) {
    return (
      <View style={styles.container}>
        <Header />
        {/* Only Overview is mounted. Pass isWeak so it shows low-data banner. */}
        <Overview legislationId={legislationId} isWeak />
        {/* No TabBar, no Footer, no ScrollView, no gestures */}
      </View>
    );
  }

  // ✅ NORMAL MODE: your existing tab system (unchanged)
  return (
    <View style={styles.container}>
      <Header />
      {/* Your existing TabBar — pass isWeak for defensive no-ops */}
      <TabBar isWeak={false} />
      <Animated.ScrollView
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        // ...rest of your existing scroll logic & listeners
      >
        {/* TABS[0]..TABS[3] children unchanged */}
      </Animated.ScrollView>
      <Footer />
    </View>
  );
}

const BookmarkButton = memo(function BookmarkButton({ isBookmarked, setIsBookmarked }: { isBookmarked: boolean; setIsBookmarked: React.Dispatch<React.SetStateAction<boolean>> }) {
  const { user } = useAuth();
  
  const handleBookmarkToggle = async () => {
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    
    // Note: This component doesn't have a specific profile ID, so bookmarking is limited
    // You may want to implement this based on your specific use case
    console.log('Bookmark toggle requested but no profile ID available');
  };

  // Always show bookmark button
  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={handleBookmarkToggle}
      hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
    >
      <Image
        source={
          isBookmarked
            ? require('../assets/bookmark2.png')
            : require('../assets/bookmark1.png')
        }
        style={styles.headerIcon}
      />
    </TouchableOpacity>
  );
});

const Header = memo(function Header() {
  const [isBookmarked, setIsBookmarked] = React.useState(false);
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={() => router.back()}
        hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
      >
        <Image
          source={require('../assets/back1.png')}
          style={styles.headerIcon}
        />
      </TouchableOpacity>
      
      <BookmarkButton isBookmarked={isBookmarked} setIsBookmarked={setIsBookmarked} />
    </View>
  );
});

const TabBar = memo(function TabBar({ isWeak = false }: { isWeak?: boolean }) {
  const safeOnPress = (idx: number) => {
    if (isWeak) return; // guard — though in weak mode TabBar is not mounted
    // onPressTab?.(idx);
  };

  return (
    <View style={styles.bottomBarWrapper}>
      <View style={styles.bottomBarPill}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButton}
            onPress={() => safeOnPress(idx)}
          >
            <Text style={styles.tabText}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const Footer = memo(function Footer() {
  return (
    <View style={styles.footerContainer}>
      <Text style={styles.footerText}>Footer Content</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // HEADER
  headerContainer: {
    position: 'absolute',
    top: 30, // edit this to move header up/down
    left: 0,
    right: 0,
    height: 60,
    paddingTop: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 100,
  },
  headerIconBtn: {
    padding: 8,
    marginHorizontal: 2,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },

  // LOADING
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },

  // FOOTER / TABS
  bottomBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom:50,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomBarPill: {
    backgroundColor: '#151515',
    borderRadius: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 350,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // FOOTER
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 12,
  },

  // CONTAINER
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
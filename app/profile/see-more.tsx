import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { safeNativeCall } from '../../utils/nativeCallDebugger';
import { persistentLogger } from '../../utils/persistentLogger';

// #region agent log - module level
fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'see-more.tsx:MODULE',message:'Module loaded',data:{safeNativeCall:typeof safeNativeCall,persistentLogger:typeof persistentLogger,Animated:typeof Animated},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
// #endregion

interface SeeMoreProps {
  name?: string;
  position?: string;
  approvalPercentage?: number;
  disapprovalPercentage?: number;
  pollSummary?: string;
  pollLink?: string;
}

function getDisplayText(url: string) {
  try {
    // If url is a full URL, use the URL object
    const u = new URL(url);
    return u.hostname;
  } catch {
    // If url is not a full URL, fallback to regex for domain extraction
    const match = url.match(/^([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
    return match ? match[1] : url;
  }
}

export default function SeeMore({ 
  name = 'No Data Available', 
  position = 'No Data Available',
  approvalPercentage = 50,
  disapprovalPercentage = 50,
  pollSummary = '',
  pollLink = ''
}: SeeMoreProps) {
  // #region agent log - component entry
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'see-more.tsx:ENTRY',message:'SeeMore component entered',data:{name,position,approvalPercentage,disapprovalPercentage},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const router = useRouter();
  const params = useLocalSearchParams();
  // #region agent log - params
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'see-more.tsx:PARAMS',message:'Params received',data:{paramsKeys:Object.keys(params),name:params.name,approval:params.approval},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Use passed params directly (reverted to previous system - no fetching)
  const politicianName = params.name as string || name || 'No Data Available';
  const politicianPosition = params.position as string || position || 'No Data Available';
  const approval = params.approval ? Number(params.approval) : (approvalPercentage || 50);
  const disapproval = params.disapproval ? Number(params.disapproval) : (disapprovalPercentage || 50);
  const pollSummaryText = (params.pollSummary as string) || pollSummary || '';
  const pollLinkText = (params.pollLink as string) || pollLink || '';
  
  const [isLoading] = useState<boolean>(false);
  const [hasError] = useState<boolean>(false);

  // Check if both approval and disapproval values are valid (not null/undefined and not default fallback values)
  const hasValidPollData = () => {
    // Check if values are not null/undefined and not the default fallback values
    const hasValidApproval = approval !== null && approval !== undefined && approval !== 50;
    const hasValidDisapproval = disapproval !== null && disapproval !== undefined && disapproval !== 50;
    
    // Also check if values are reasonable (between 0-100)
    const isApprovalInRange = approval >= 0 && approval <= 100;
    const isDisapprovalInRange = disapproval >= 0 && disapproval <= 100;
    
    return hasValidApproval && hasValidDisapproval && isApprovalInRange && isDisapprovalInRange;
  };

  // Handler for opening links
  const handleLinkPress = async (url: string) => {
    persistentLogger.checkpoint('see-more:handleLinkPress:before', { url: url?.substring(0, 50) });
    
    // Haptics call with checkpoint
    try {
      await safeNativeCall('haptics', 'selectionAsync', {}, () => {
        Haptics.selectionAsync();
        return Promise.resolve();
      });
      persistentLogger.checkpoint('see-more:haptics:success');
    } catch (error) {
      persistentLogger.log('see-more:haptics:error', { error }, 'error');
    }
    
    // Linking calls with checkpoints
    try {
      persistentLogger.checkpoint('see-more:linking:canOpenURL:before', { url });
      
      const supported = await safeNativeCall(
        'linking',
        'canOpenURL',
        { url },
        () => Linking.canOpenURL(url)
      );
      
      if (supported) {
        persistentLogger.checkpoint('see-more:linking:openURL:before', { url });
        await safeNativeCall(
          'linking',
          'openURL',
          { url },
          () => Linking.openURL(url)
        );
        persistentLogger.checkpoint('see-more:linking:openURL:success');
      } else {
        persistentLogger.log('see-more:linking:notSupported', { url });
      }
    } catch (error) {
      persistentLogger.log('see-more:linking:error', { error, url }, 'error');
    }
  };

  // Link data configuration
  const linkData = [
    {
      id: 'whitehouse',
      url: 'https://whitehouse.gov'
    }
  ];

  // Animation values
  const approvalBarWidth = useRef(new Animated.Value(0)).current;
  const disapprovalBarWidth = useRef(new Animated.Value(0)).current;
  const approvalNumber = useRef(new Animated.Value(0)).current;
  const disapprovalNumber = useRef(new Animated.Value(0)).current;
  const containerWidth = useRef(0);

  // Header component (same as index1.tsx but without bookmark)
  const Header = () => {
    const handleBack = () => {
      persistentLogger.checkpoint('see-more:router:back:before');
      try {
        safeNativeCall('router', 'back', {}, () => {
          router.back();
          return Promise.resolve();
        });
        persistentLogger.checkpoint('see-more:router:back:success');
      } catch (error) {
        persistentLogger.log('see-more:router:back:error', { error }, 'error');
      }
    };
    
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>
    );
  };

  // Animate the approval/disapproval split meter and numbers
  useEffect(() => {
    const animateBars = () => {
      // Calculate the meter width (accounting for padding)
      const meterWidth = containerWidth.current - 40; // Subtract padding from container width
      
      // Calculate total for proportional sizing
      const total = approval + disapproval;
      
      // Animate approval fill (left side of meter) - proportional to total
      Animated.timing(approvalBarWidth, {
        toValue: total > 0 ? (approval / total) * meterWidth : 0,
        duration: 1200,
        useNativeDriver: false,
      }).start();

      // Animate disapproval fill (right side of meter) - proportional to total
      Animated.timing(disapprovalBarWidth, {
        toValue: total > 0 ? (disapproval / total) * meterWidth : 0,
        duration: 1200,
        useNativeDriver: false,
      }).start();

      // Animate approval number
      Animated.timing(approvalNumber, {
        toValue: approval,
        duration: 1200,
        useNativeDriver: false,
      }).start();

      // Animate disapproval number
      Animated.timing(disapprovalNumber, {
        toValue: disapproval,
        duration: 1200,
        useNativeDriver: false,
      }).start();
    };

    // Start animation after a short delay
    const timer = setTimeout(animateBars, 300);
    return () => clearTimeout(timer);
  }, [approval, disapproval]);

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading metrics...</Text>
        </View>
      </View>
    );
  }
  
  // Show error state
  if (hasError) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load metrics data.</Text>
          <Text style={styles.errorSubtext}>Please try again later.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Approval/Disapproval Split Horizontal Meter - Only show if both values are valid */}
        {hasValidPollData() && (
          <View style={styles.barContainer}>
            <View 
              style={styles.barWrapper}
              onLayout={(e) => {
                containerWidth.current = e.nativeEvent.layout.width;
              }}
            >
              {/* Percentage Labels */}
              <View style={styles.percentageLabels}>
                <Animated.Text style={styles.percentageText}>
                  {approvalNumber.interpolate({
                    inputRange: [0, approval],
                    outputRange: ['0%', `${approval}%`],
                  })}
                </Animated.Text>
                <Animated.Text style={styles.percentageText}>
                  {disapprovalNumber.interpolate({
                    inputRange: [0, disapproval],
                    outputRange: ['0%', `${disapproval}%`],
                  })}
                </Animated.Text>
              </View>

              {/* Split Horizontal Meter */}
              <View style={styles.meterContainer}>
                <View style={styles.meterBackground}>
                  <View style={{ flexDirection: 'row', height: '100%' }}>
                    {/* Approval Fill (Left Side) */}
                    <Animated.View 
                      style={[
                        styles.approvalFill,
                        { width: approvalBarWidth }
                      ]} 
                    />
                    {/* Disapproval Fill (Right Side) */}
                    <Animated.View 
                      style={[
                        styles.disapprovalFill,
                        { width: disapprovalBarWidth }
                      ]} 
                    />
                  </View>
                </View>
              </View>

              {/* Labels */}
              <View style={styles.meterLabels}>
                <Text style={styles.barLabel}>Approval</Text>
                <Text style={styles.barLabel}>Disapproval</Text>
              </View>
            </View>
          </View>
        )}



        {/* Static Data Container */}
        <View style={styles.dataContainer}>
          <Text style={styles.dataText}>{pollSummaryText || 'No Data Available'}</Text>
        </View>

        {/* Links Row */}
        <View style={styles.linksRow}>
          {pollLinkText ? (
            <TouchableOpacity
              style={styles.linkPill}
              onPress={() => handleLinkPress(pollLinkText)}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>{getDisplayText(pollLinkText)}</Text>
            </TouchableOpacity>
          ) : (
            linkData.map((link) => (
              <TouchableOpacity
                key={link.id}
                style={styles.linkPill}
                onPress={() => handleLinkPress(link.url)}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>{getDisplayText(link.url)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    position: 'absolute',
    top: 30,
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
  scrollView: {
    flex: 1,
    marginTop: 90, // Account for header
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  barContainer: {
    marginTop: 20,
    marginBottom: 20,
    width: '105%',
    alignSelf: 'center',
  },
  barWrapper: {
    backgroundColor: '#050505',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  percentageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  percentageText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  meterContainer: {
    marginBottom: 12,
  },
  meterBackground: {
    height: 12,
    backgroundColor: '#151515',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  approvalFill: {
    height: '100%',
    backgroundColor: '#008610', // Same green as profile star ratings
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  disapprovalFill: {
    height: '100%',
    backgroundColor: '#8F0000', // Same red as disapproval text
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  dataContainer: {
    backgroundColor: '#050505', // Same as legi1 card buttons
    borderRadius: 18,
    width: '105%',
    alignSelf: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#101010',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dataText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'left',
  },
  // Links Row
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    width: '100%',
    alignSelf: 'center',
  },
  linkPill: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: '#434343',
    fontSize: 11,
    fontWeight: '400',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 90,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '400',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 90,
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
}); 
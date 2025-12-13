import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSupabaseClient } from '../../utils/supabase';

interface OverviewProps {
  scrollY?: any;
  name?: string;
  position?: string;
  legislationId?: string;
  isWeak?: boolean;
}

export default function Overview({ scrollY, name, position, legislationId: propLegislationId, isWeak = false }: OverviewProps) {
  const params = useLocalSearchParams();
  const [congressData, setCongressData] = useState<{congress: string, bill_status: string} | null>(null);
  const [congressLink, setCongressLink] = useState<string | null>(null);
  
  // Get the legislation ID from prop or navigation parameters
  const legislationId = propLegislationId || (typeof params.index === 'string' ? params.index : '');
  
  // Fetch congress and bill_status from legi_index
  useEffect(() => {
    const fetchCongressData = async () => {
      if (legislationId) {
        try {
          const { data, error } = await supabase
            .from('legi_index')
            .select('congress, bill_status')
            .eq('id', parseInt(legislationId))
            .single();
          
          if (!error && data) {
            setCongressData({
              congress: data.congress || '',
              bill_status: data.bill_status || ''
            });
          }
        } catch (error) {
          console.error('Error fetching congress data:', error);
        }
      }
    };

    fetchCongressData();
  }, [legislationId]);

  // Fetch congress link from web_content
  useEffect(() => {
    const fetchCongressLink = async () => {
      if (legislationId) {
        try {
          const { data, error } = await supabase
            .from('web_content')
            .select('link')
            .eq('owner_id', parseInt(legislationId))
            .eq('is_ppl', false)
            .ilike('link', '%congress%')
            .limit(1)
            .single();
          
          if (!error && data?.link) {
            setCongressLink(data.link);
          }
        } catch (error) {
          console.error('Error fetching congress link:', error);
        }
      }
    };

    fetchCongressLink();
  }, [legislationId]);

  // Format the status display
  const getStatusDisplay = () => {
    if (!congressData || !congressData.congress || !congressData.bill_status) {
      return 'Congress session: No Data';
    }
    
    const congressSession = congressData.congress;
    const billStatus = congressData.bill_status;
    
    // Capitalize the first letter of bill status
    const formattedStatus = billStatus.charAt(0).toUpperCase() + billStatus.slice(1);
    
    return `${congressSession} Congress: ${formattedStatus}`;
  };

  // Handler for opening congress link
  const handleCongressLinkPress = async () => {
    if (!congressLink) return;
    
    try {
      const supported = await Linking.canOpenURL(congressLink);
      if (supported) {
        await Linking.openURL(congressLink);
      } else {
        console.log("Can't open URL: " + congressLink);
      }
    } catch (error) {
      console.error("Error opening URL: ", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Overview</Text>
      <Text style={styles.statusText}>{getStatusDisplay()}</Text>
      
      {/* Low Data Message */}
      {isWeak && (
        <View style={styles.lowDataContainer}>
          <Text style={styles.lowDataTitle}>Legislation Too Small</Text>
          <Text style={styles.lowDataMessage}>
            This legislation doesn't have enough material to generate a complete profile. We've limited this view to an overview. If you believe this is a mistake, try adding credible sources and regenerating later.
          </Text>
        </View>
      )}
      
      {/* Congress Link Pill */}
      {congressLink && (
        <View style={styles.linksRow}>
          <TouchableOpacity
            style={styles.linkPill}
            onPress={handleCongressLinkPress}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>congress.gov</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  statusText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 10,
    textAlign: 'center',
  },
  // Links Row (copied from legi5)
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
  // Low Data Message styles (dark theme)
  lowDataContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#040404',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#101010',
  },
  lowDataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  lowDataMessage: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
    textAlign: 'center',
  },
}); 
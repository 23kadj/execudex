import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

export default function DebugSupabase() {
  const [tables, setTables] = useState<any[]>([]);
  const [pplIndexData, setPplIndexData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const debugSupabase = async () => {
      try {
        // Test basic connection
        console.log('Testing Supabase connection...');
        
        // Try to get table info (this might not work depending on permissions)
        const { data: tableData, error: tableError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public');
        
        if (tableError) {
          console.log('Could not fetch table list:', tableError);
        } else {
          console.log('Available tables:', tableData);
          setTables(tableData || []);
        }
        
        // Try to fetch from ppl_index
        const { data: pplData, error: pplError } = await supabase
          .from('ppl_index')
          .select('*')
          .limit(10);
        
        if (pplError) {
          console.log('Error fetching from ppl_index:', pplError);
          setError(pplError.message);
        } else {
          console.log('ppl_index data:', pplData);
          setPplIndexData(pplData || []);
        }
        
      } catch (err) {
        console.error('Debug error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };
    
    debugSupabase();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Supabase Debug Info</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.testButton}
          onPress={() => router.push('/test-ppl-data')}
        >
          <Text style={styles.buttonText}>Test PPL Data Service</Text>
        </TouchableOpacity>
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error:</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Tables:</Text>
        {tables.length > 0 ? (
          tables.map((table, index) => (
            <Text key={index} style={styles.tableName}>
              {table.table_name}
            </Text>
          ))
        ) : (
          <Text style={styles.noData}>No table info available</Text>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ppl_index Data:</Text>
        {pplIndexData.length > 0 ? (
          pplIndexData.map((row, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.rowText}>Row {index + 1}:</Text>
              <Text style={styles.rowData}>{JSON.stringify(row, null, 2)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No data in ppl_index table</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 5,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  tableName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  noData: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  row: {
    marginBottom: 10,
  },
  rowText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  rowData: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 4,
  },
});

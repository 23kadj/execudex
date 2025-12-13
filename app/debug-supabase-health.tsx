import Constants from 'expo-constants';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

interface TestResult {
  success: boolean;
  rowCount?: number;
  error?: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  };
}

interface TableTestResult {
  tableName: string;
  result: TestResult;
}

export default function DebugSupabaseHealth() {
  const [testResults, setTestResults] = useState<TableTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testTimestamp, setTestTimestamp] = useState<string>('');

  const runTest = async () => {
    setIsRunning(true);
    setTestTimestamp(new Date().toISOString());
    setTestResults([]);
    
    try {
      const supabase = getSupabaseClient();
      
      // Test multiple tables
      const tablesToTest = [
        { name: 'ppl_index', query: supabase.from('ppl_index').select('id', { count: 'exact' }).limit(1) },
        { name: 'ppl_profiles', query: supabase.from('ppl_profiles').select('id', { count: 'exact' }).limit(1) },
        { name: 'card_index', query: supabase.from('card_index').select('id', { count: 'exact' }).limit(1) },
        { name: 'card_content', query: supabase.from('card_content').select('id', { count: 'exact' }).limit(1) },
      ];
      
      const results: TableTestResult[] = [];
      
      for (const { name, query } of tablesToTest) {
        try {
          const { data, error, count } = await query;
          
          if (error) {
            results.push({
              tableName: name,
              result: {
                success: false,
                error: {
                  message: error.message || 'Unknown error',
                  code: error.code || undefined,
                  details: error.details || undefined,
                  hint: error.hint || undefined,
                },
              },
            });
          } else {
            results.push({
              tableName: name,
              result: {
                success: true,
                rowCount: count !== null && count !== undefined ? count : (data?.length ?? 0),
              },
            });
          }
        } catch (err) {
          results.push({
            tableName: name,
            result: {
              success: false,
              error: {
                message: err instanceof Error ? err.message : String(err),
              },
            },
          });
        }
      }
      
      setTestResults(results);
    } catch (err) {
      setTestResults([{
        tableName: 'Connection',
        result: {
          success: false,
          error: {
            message: err instanceof Error ? err.message : String(err),
          },
        },
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  // Get environment variables
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  
  // Get Constants info (safely, avoiding secrets)
  const extra = Constants.expoConfig?.extra;
  const manifest = Constants.manifest;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Supabase Health Check</Text>
      
      {/* Environment Variables Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environment Variables</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>EXPO_PUBLIC_SUPABASE_URL:</Text>
          <Text style={styles.value}>
            {supabaseUrl 
              ? `${supabaseUrl.substring(0, 20)}... (${supabaseUrl.length} chars)` 
              : '❌ NOT SET'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>EXPO_PUBLIC_SUPABASE_KEY:</Text>
          <Text style={styles.value}>
            {supabaseKey 
              ? `${supabaseKey.substring(0, 10)}... (${supabaseKey.length} chars)` 
              : '❌ NOT SET'}
          </Text>
        </View>
      </View>

      {/* Constants Info Section */}
      {(extra || manifest) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Build Configuration</Text>
          
          {extra && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>expoConfig.extra:</Text>
              <Text style={styles.value}>
                {Object.keys(extra).length > 0 
                  ? `${Object.keys(extra).length} keys present` 
                  : 'Empty'}
              </Text>
            </View>
          )}
          
          {manifest && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>manifest:</Text>
              <Text style={styles.value}>
                {manifest.id ? `ID: ${manifest.id}` : 'Available'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Test Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Test</Text>
        
        <TouchableOpacity 
          style={[styles.button, isRunning && styles.buttonDisabled]}
          onPress={runTest}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Running...' : 'Re-run Test'}
          </Text>
        </TouchableOpacity>

        {testTimestamp && (
          <Text style={styles.timestamp}>Last test: {testTimestamp}</Text>
        )}

        {testResults.length > 0 && (
          <View style={styles.resultsContainer}>
            {testResults.map((tableTest, index) => (
              <View key={index} style={styles.resultContainer}>
                <Text style={styles.tableName}>{tableTest.tableName}</Text>
                {tableTest.result.success ? (
                  <View style={styles.successContainer}>
                    <Text style={styles.successTitle}>✅ Success</Text>
                    <Text style={styles.successText}>
                      Query executed successfully
                    </Text>
                    {tableTest.result.rowCount !== undefined && (
                      <Text style={styles.successText}>
                        Rows: {tableTest.result.rowCount}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>❌ Error</Text>
                    {tableTest.result.error && (
                      <>
                        <Text style={styles.errorLabel}>Message:</Text>
                        <Text style={styles.errorText}>
                          {tableTest.result.error.message}
                        </Text>
                        
                        {tableTest.result.error.code && (
                          <>
                            <Text style={styles.errorLabel}>Code:</Text>
                            <Text style={styles.errorText}>
                              {tableTest.result.error.code}
                            </Text>
                          </>
                        )}
                        
                        {tableTest.result.error.details && (
                          <>
                            <Text style={styles.errorLabel}>Details:</Text>
                            <Text style={styles.errorText}>
                              {tableTest.result.error.details}
                            </Text>
                          </>
                        )}
                        
                        {tableTest.result.error.hint && (
                          <>
                            <Text style={styles.errorLabel}>Hint:</Text>
                            <Text style={styles.errorText}>
                              {tableTest.result.error.hint}
                            </Text>
                          </>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instructionText}>
          • This screen tests Supabase connectivity by querying multiple tables{'\n'}
          • Tests: ppl_index, ppl_profiles, card_index, card_content{'\n'}
          • Tap "Re-run Test" to execute a new test{'\n'}
          • Check environment variables are set in your build configuration{'\n'}
          • Review error details if any test fails
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoRow: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 4,
  },
  button: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  resultsContainer: {
    marginTop: 10,
  },
  resultContainer: {
    marginBottom: 15,
  },
  tableName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 4,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 12,
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c62828',
    marginTop: 8,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    fontFamily: 'monospace',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});


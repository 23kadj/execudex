import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { clearStartupLog, getStartupLog } from '../utils/startupLogger';
import { areTextInputsDisabled, setTextInputsDisabled } from '../utils/debugFlags';

export default function DebugStartupLog() {
  const [logContent, setLogContent] = useState<string>('Loading...');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [textInputsDisabled, setTextInputsDisabledState] = useState<boolean>(false);

  const loadLog = async () => {
    setIsRefreshing(true);
    try {
      const log = await getStartupLog();
      setLogContent(log);
    } catch (error) {
      setLogContent(`Error loading log: ${error}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearStartupLog();
      setLogContent('Startup log cleared.');
      // Reload after a brief delay to show the cleared message
      setTimeout(() => {
        loadLog();
      }, 500);
    } catch (error) {
      setLogContent(`Error clearing log: ${error}`);
    }
  };

  useEffect(() => {
    loadLog();
    // Load TextInput disable state
    areTextInputsDisabled().then(set => setTextInputsDisabledState(set));
  }, []);
  
  const handleTextInputToggle = async (value: boolean) => {
    setTextInputsDisabledState(value);
    await setTextInputsDisabled(value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Startup Log</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.refreshButton]}
            onPress={loadLog}
            disabled={isRefreshing}
          >
            <Text style={styles.buttonText}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
          >
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.debugToggleContainer}>
          <Text style={styles.debugToggleLabel}>Disable TextInputs (iOS crash test)</Text>
          <Switch
            value={textInputsDisabled}
            onValueChange={handleTextInputToggle}
            trackColor={{ false: '#767577', true: '#34C759' }}
            thumbColor={textInputsDisabled ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.logText}>{logContent}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#34C759',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  logText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  debugToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  debugToggleLabel: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
});


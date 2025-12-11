import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PPLDataService } from '../services/pplDataService';

export default function TestPPLData() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testGetProfileIndex = async () => {
    try {
      addResult('Testing getProfileIndex...');
      const profile = await PPLDataService.getProfileIndex(1);
      if (profile) {
        addResult(`✅ Found profile: ${profile.name} (tier: ${profile.tier})`);
      } else {
        addResult('❌ No profile found for ID 1');
      }
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testCreateCard = async () => {
    try {
      addResult('Testing createCardWithContent...');
      const cardId = await PPLDataService.createCardWithContent(
        {
          owner_id: 1,
          created_at: new Date().toISOString(),
          is_active: true,
          is_ppl: true,
          title: 'Test Card',
          subtext: 'This is a test card created by the PPL Data system',
          screen: 'agenda_ppl',
          category: 'economy',
          score: 85,
          is_media: false,
          link: 'https://example.com/test'
        },
        {
          title: 'Test Card',
          link1: 'https://example.com/test',
          web_content: 'This is test content for the card. It should be stored in the card_content table.',
          body_text: '',
          tldr: '',
          legi_text: ''
        }
      );
      addResult(`✅ Created card with ID: ${cardId}`);
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testGetActiveCards = async () => {
    try {
      addResult('Testing getActiveCards...');
      const cards = await PPLDataService.getActiveCards(1);
      addResult(`✅ Found ${cards.length} active cards for owner ID 1`);
      cards.forEach(card => {
        addResult(`  - Card ${card.id}: "${card.title}" (${card.screen}/${card.category})`);
      });
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testReviveOrInsert = async () => {
    try {
      addResult('Testing reviveOrInsertCard...');
      const cardId = await PPLDataService.reviveOrInsertCard(
        1,
        'test card', // normalized title
        {
          owner_id: 1,
          created_at: new Date().toISOString(),
          is_active: true,
          is_ppl: true,
          title: 'Test Card (Revived)',
          subtext: 'This card was either revived or newly created',
          screen: 'agenda_ppl',
          category: 'economy',
          score: 90,
          is_media: false,
          link: 'https://example.com/test-revived'
        },
        {
          title: 'Test Card (Revived)',
          link1: 'https://example.com/test-revived',
          web_content: 'This is test content for a revived card.',
          body_text: '',
          tldr: '',
          legi_text: ''
        }
      );
      addResult(`✅ Revived/Inserted card with ID: ${cardId}`);
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    addResult('🚀 Starting PPL Data Service Tests...');
    
    await testGetProfileIndex();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    await testCreateCard();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetActiveCards();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testReviveOrInsert();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetActiveCards(); // Check again to see the new cards
    
    addResult('✅ All tests completed!');
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PPL Data Service Test</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Tests...' : 'Run All Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={clearResults}>
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
});


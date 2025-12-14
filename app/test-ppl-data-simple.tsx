import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

export default function TestPPLDataSimple() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testDirectCardCreation = async () => {
    try {
      const supabase = getSupabaseClient();
      addResult('Testing direct card creation...');
      
      // First, let's check what tables exist
      addResult('Checking available tables...');
      const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .like('table_name', '%card%');
      
      if (!tableError && tables) {
        addResult(`Available card tables: ${tables.map(t => t.table_name).join(', ')}`);
      }
      
      // FIRST: Check if we already have cards for this owner
      const { data: existingCards, error: fetchError } = await supabase
        .from('card_index')
        .select('*')
        .eq('owner_id', 1);

      if (fetchError) {
        addResult(`❌ Fetch existing cards error: ${fetchError.message}`);
        return;
      }

      if (existingCards && existingCards.length > 0) {
        addResult(`ℹ️ Found ${existingCards.length} existing cards for owner 1:`);
        existingCards.forEach(card => {
          addResult(`  - Card ${card.id}: "${card.title}" (${card.screen}/${card.category})`);
        });
        addResult(`ℹ️ Skipping card creation to preserve existing data`);
        return;
      }

      // ONLY create if no cards exist
      addResult('ℹ️ No existing cards found, creating new one...');
      const { data: cardResult, error: cardError } = await supabase
        .from('card_index')
        .insert({
          owner_id: 1,
          title: `Test Card ${Date.now()}`,
          screen: 'agenda_ppl',
          category: 'economy'
        })
        .select('id')
        .single();

      if (cardError) {
        addResult(`❌ Minimal card creation error: ${cardError.message}`);
        addResult(`❌ Error details: ${JSON.stringify(cardError, null, 2)}`);
        return;
      }

      addResult(`✅ Created minimal card with ID: ${cardResult.id}`);

    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testGetActiveCards = async () => {
    try {
      const supabase = getSupabaseClient();
      addResult('Testing getActiveCards...');
      const { data: cards, error } = await supabase
        .from('card_index')
        .select('*')
        .eq('owner_id', 1)
        .eq('is_active', true);

      if (error) {
        addResult(`❌ Error: ${error.message}`);
        return;
      }

      addResult(`✅ Found ${cards.length} active cards for owner ID 1`);
      cards.forEach(card => {
        addResult(`  - Card ${card.id}: "${card.title}" (${card.screen}/${card.category})`);
      });
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testGetProfileData = async () => {
    try {
      const supabase = getSupabaseClient();
      addResult('Testing getProfileData...');
      const { data: profile, error } = await supabase
        .from('ppl_profiles')
        .select('*')
        .eq('index_id', 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        addResult(`❌ Error: ${error.message}`);
        return;
      }

      if (profile) {
        addResult(`✅ Found profile data: ${JSON.stringify(profile, null, 2)}`);
      } else {
        addResult('ℹ️ No profile data found for ID 1');
      }
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testUpdateProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      addResult('Testing updateProfile...');
      
      // FIRST: Scan what already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('ppl_profiles')
        .select('*')
        .eq('index_id', 1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        addResult(`❌ Fetch error: ${fetchError.message}`);
        return;
      }

      if (existingProfile) {
        addResult(`ℹ️ Found existing profile: ${JSON.stringify(existingProfile, null, 2)}`);
        addResult(`ℹ️ Skipping update to preserve existing data`);
        return;
      }

      // ONLY create if nothing exists
      addResult('ℹ️ No existing profile found, creating new one...');
      const { error } = await supabase
        .from('ppl_profiles')
        .insert({
          index_id: 1,
          synopsis: 'Test synopsis created by direct call',
          approval: 45,
          disapproval: 55,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        addResult(`❌ Insert error: ${error.message}`);
        return;
      }

      addResult(`✅ Created new profile data for ID 1`);
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    }
  };

  const testTableStructure = async () => {
    try {
      const supabase = getSupabaseClient();
      addResult('Testing table structure...');
      
      // Check all tables
      const { data: allTables, error: allTablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (!allTablesError && allTables) {
        addResult(`All tables: ${allTables.map(t => t.table_name).join(', ')}`);
      }
      
      // Check card_index table structure
      const { data: cardIndexData, error: cardIndexError } = await supabase
        .from('card_index')
        .select('*')
        .limit(1);
      
      if (cardIndexError) {
        addResult(`❌ card_index error: ${cardIndexError.message}`);
      } else {
        addResult(`✅ card_index accessible, sample: ${JSON.stringify(cardIndexData, null, 2)}`);
      }
      
    } catch (error) {
      addResult(`❌ Table structure error: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    addResult('🚀 Starting Direct PPL Data Tests...');
    
    await testTableStructure();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetProfileData();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testDirectCardCreation();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetActiveCards();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testUpdateProfile();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetActiveCards(); // Check again
    
    addResult('✅ All direct tests completed!');
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PPL Data Direct Test</Text>
      <Text style={styles.subtitle}>Testing without RPC functions</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Tests...' : 'Run Direct Tests'}
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
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
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

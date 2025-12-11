import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HousekeepingService } from '../services/housekeepingService';
import { supabase } from '../utils/supabase';

export default function TestStep3Housekeeping() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getFirstPolitician = async () => {
    try {
      const { data: politicians, error } = await supabase
        .from('ppl_index')
        .select('*')
        .order('id', { ascending: true })
        .limit(1);

      if (error) {
        throw new Error(`Failed to fetch first politician: ${error.message}`);
      }

      if (!politicians || politicians.length === 0) {
        throw new Error('No politicians found in ppl_index');
      }

      return politicians[0];
    } catch (error) {
      addResult(`❌ Error getting first politician: ${error.message}`);
      return null;
    }
  };

  const testHousekeepingStats = async () => {
    try {
      addResult('Testing housekeeping statistics...');
      
      // Get the first politician
      const politician = await getFirstPolitician();
      if (!politician) return;
      
      addResult(`\n👤 Using politician: ${politician.name} (ID: ${politician.id})`);
      
      const stats = await HousekeepingService.getHousekeepingStats(politician.id);
      
      addResult(`✅ Housekeeping stats for ${politician.name}:`);
      addResult(`   Total cards: ${stats.totalCards}`);
      addResult(`   Active cards: ${stats.activeCards}`);
      addResult(`   Inactive cards: ${stats.inactiveCards}`);
      addResult(`   Old active cards (>7 days): ${stats.oldActiveCards}`);
      addResult(`   Bookmarked cards: ${stats.bookmarkedCards}`);
      
    } catch (error) {
      addResult(`❌ Housekeeping stats error: ${error.message}`);
    }
  };

  const testNeedsHousekeeping = async () => {
    try {
      addResult('Testing if housekeeping is needed...');
      
      // Get the first politician
      const politician = await getFirstPolitician();
      if (!politician) return;
      
      addResult(`\n👤 Using politician: ${politician.name} (ID: ${politician.id})`);
      
      const needsHousekeeping = await HousekeepingService.needsHousekeeping(politician.id);
      
      addResult(`✅ Housekeeping needed for ${politician.name}: ${needsHousekeeping ? 'YES' : 'NO'}`);
      
    } catch (error) {
      addResult(`❌ Needs housekeeping check error: ${error.message}`);
    }
  };

  const testHousekeepingReport = async () => {
    try {
      addResult('Testing housekeeping report...');
      
      // Get the first politician
      const politician = await getFirstPolitician();
      if (!politician) return;
      
      addResult(`\n👤 Using politician: ${politician.name} (ID: ${politician.id})`);
      
      const report = await HousekeepingService.getHousekeepingReport(politician.id);
      
      addResult(`✅ Housekeeping report for ${politician.name}:`);
      addResult(`   Stats: ${JSON.stringify(report.stats, null, 2)}`);
      addResult(`   Old cards count: ${report.oldCards.length}`);
      addResult(`   Bookmarked cards: ${report.bookmarkedCards.join(', ')}`);
      
      if (report.oldCards.length > 0) {
        addResult(`   Old cards details:`);
        report.oldCards.forEach(card => {
          addResult(`     - Card ${card.id}: "${card.title}" (${card.screen}/${card.category}) - Created: ${card.created_at}`);
        });
      }
      
    } catch (error) {
      addResult(`❌ Housekeeping report error: ${error.message}`);
    }
  };

  const testPerformHousekeeping = async () => {
    try {
      addResult('Testing housekeeping execution...');
      addResult('⚠️ WARNING: This will actually deactivate old cards and delete unbookmarked content!');
      
      // Get the first politician
      const politician = await getFirstPolitician();
      if (!politician) return;
      
      addResult(`\n👤 Using politician: ${politician.name} (ID: ${politician.id})`);
      
      // Get stats before
      const statsBefore = await HousekeepingService.getHousekeepingStats(politician.id);
      addResult(`Before housekeeping: ${statsBefore.oldActiveCards} old active cards`);
      
      // Perform housekeeping
      const result = await HousekeepingService.performHousekeeping(politician.id);
      
      addResult(`✅ Housekeeping completed:`);
      addResult(`   Cards scanned: ${result.cardsScanned}`);
      addResult(`   Cards deactivated: ${result.cardsDeactivated}`);
      addResult(`   Cards reactivated: ${result.cardsReactivated || 0}`);
      addResult(`   Content deleted: ${result.contentDeleted}`);
      addResult(`   Content protected: ${result.contentProtected}`);
      addResult(`   Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        addResult(`   Error details:`);
        result.errors.forEach(error => {
          addResult(`     - ${error}`);
        });
      }
      
      // Get stats after
      const statsAfter = await HousekeepingService.getHousekeepingStats(politician.id);
      addResult(`After housekeeping: ${statsAfter.oldActiveCards} old active cards`);
      
    } catch (error) {
      addResult(`❌ Housekeeping execution error: ${error.message}`);
    }
  };

  const testCreateTestData = async () => {
    try {
      addResult('Creating test data for housekeeping...');
      
      // Get the first politician
      const politician = await getFirstPolitician();
      if (!politician) return;
      
      addResult(`\n👤 Using politician: ${politician.name} (ID: ${politician.id})`);
      
      // Create some test cards with different ages
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      
      // Create old card (should be deactivated)
      const { data: oldCard, error: oldCardError } = await supabase
        .from('card_index')
        .insert({
          owner_id: politician.id,
          created_at: tenDaysAgo.toISOString(),
          is_active: true,
          is_ppl: true,
          title: 'Old Test Card (10 days)',
          subtext: 'This card is old and should be deactivated',
          screen: 'agenda_ppl',
          category: 'economy',
          score: 85,
          is_media: false,
          link: 'https://example.com/old-card'
        })
        .select('id')
        .single();

      if (oldCardError) {
        addResult(`❌ Failed to create old card: ${oldCardError.message}`);
        return;
      }

      addResult(`✅ Created old card with ID: ${oldCard.id}`);

      // Create recent card (should stay active)
      const { data: recentCard, error: recentCardError } = await supabase
        .from('card_index')
        .insert({
          owner_id: politician.id,
          created_at: fiveDaysAgo.toISOString(),
          is_active: true,
          is_ppl: true,
          title: 'Recent Test Card (5 days)',
          subtext: 'This card is recent and should stay active',
          screen: 'identity',
          category: 'background',
          score: 90,
          is_media: false,
          link: 'https://example.com/recent-card'
        })
        .select('id')
        .single();

      if (recentCardError) {
        addResult(`❌ Failed to create recent card: ${recentCardError.message}`);
        return;
      }

      addResult(`✅ Created recent card with ID: ${recentCard.id}`);

      // Create content for old card
      const { error: oldContentError } = await supabase
        .from('card_content')
        .insert({
          card_id: oldCard.id,
          title: 'Old Test Card Content',
          link1: 'https://example.com/old-content',
          web_content: 'This is content for the old card that should be deleted if not bookmarked',
          body_text: '',
          tldr: '',
          legi_text: '',
          created_at: new Date().toISOString()
        });

      if (oldContentError) {
        addResult(`❌ Failed to create old card content: ${oldContentError.message}`);
      } else {
        addResult(`✅ Created content for old card`);
      }

      // Create content for recent card
      const { error: recentContentError } = await supabase
        .from('card_content')
        .insert({
          card_id: recentCard.id,
          title: 'Recent Test Card Content',
          link1: 'https://example.com/recent-content',
          web_content: 'This is content for the recent card that should be preserved',
          body_text: '',
          tldr: '',
          legi_text: '',
          created_at: new Date().toISOString()
        });

      if (recentContentError) {
        addResult(`❌ Failed to create recent card content: ${recentContentError.message}`);
      } else {
        addResult(`✅ Created content for recent card`);
      }

      // Create an inactive card that should be reactivated (3 days old)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const { data: inactiveCard, error: inactiveCardError } = await supabase
        .from('card_index')
        .insert({
          owner_id: politician.id,
          created_at: threeDaysAgo.toISOString(),
          is_active: false, // This should be reactivated
          is_ppl: true,
          title: 'Inactive Test Card (3 days)',
          subtext: 'This card is inactive but recent and should be reactivated',
          screen: 'affiliates',
          category: 'party',
          score: 75,
          is_media: false,
          link: 'https://example.com/inactive-card'
        })
        .select('id')
        .single();

      if (inactiveCardError) {
        addResult(`❌ Failed to create inactive card: ${inactiveCardError.message}`);
      } else {
        addResult(`✅ Created inactive card with ID: ${inactiveCard.id}`);
      }

      addResult(`✅ Test data created successfully!`);
      
    } catch (error) {
      addResult(`❌ Test data creation error: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    addResult('🚀 Starting Step 3 Housekeeping Tests...');
    
    await testHousekeepingStats();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testNeedsHousekeeping();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testHousekeepingReport();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testCreateTestData();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testPerformHousekeeping();
    
    addResult('✅ All Step 3 tests completed!');
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step 3: Housekeeping Test</Text>
      <Text style={styles.subtitle}>Testing 7-day card lifecycle management</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Tests...' : 'Run Step 3 Tests'}
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

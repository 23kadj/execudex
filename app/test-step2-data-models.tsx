import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PPLDataService } from '../services/pplDataService';
import { ValidationService } from '../services/validationService';
import { SCREEN_MAPPING, TIER_CONFIG } from '../types/pplDataTypes';

export default function TestStep2DataModels() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testDataValidation = async () => {
    try {
      addResult('Testing data validation...');
      
      // Test profile validation
      const validProfile = {
        synopsis: 'This is a valid synopsis with exactly one hundred and fifty words to meet the minimum requirement for testing purposes. It contains enough content to pass validation and demonstrates the word count checking functionality that ensures proper data quality in the PPL system.',
        approval: 45,
        disapproval: 55
      };
      
      const invalidProfile = {
        synopsis: 'Too short',
        approval: 150, // Invalid: over 100
        disapproval: 60
      };
      
      const validResult = ValidationService.validateProfileData(validProfile);
      const invalidResult = ValidationService.validateProfileData(invalidProfile);
      
      addResult(`✅ Valid profile: ${validResult.isValid ? 'PASSED' : 'FAILED'}`);
      addResult(`✅ Invalid profile: ${invalidResult.isValid ? 'FAILED' : 'PASSED'} - ${invalidResult.errors.join(', ')}`);
      
      // Test card validation
      const validCard = {
        owner_id: 1,
        title: 'This is a valid card title with sufficient length',
        screen: 'agenda_ppl' as const,
        category: 'economy',
        score: 85
      };
      
      const invalidCard = {
        owner_id: 1,
        title: 'Short', // Too short
        screen: 'invalid_screen' as any,
        score: 150 // Invalid: over 100
      };
      
      const validCardResult = ValidationService.validateCardData(validCard);
      const invalidCardResult = ValidationService.validateCardData(invalidCard);
      
      addResult(`✅ Valid card: ${validCardResult.isValid ? 'PASSED' : 'FAILED'}`);
      addResult(`✅ Invalid card: ${invalidCardResult.isValid ? 'FAILED' : 'PASSED'} - ${invalidCardResult.errors.join(', ')}`);
      
    } catch (error) {
      addResult(`❌ Validation test error: ${error.message}`);
    }
  };

  const testQuotaCalculation = async () => {
    try {
      addResult('Testing quota calculation...');
      
      // Test with owner ID 1 (assuming it exists)
      const quotaStatus = await PPLDataService.calculateQuotaDeficits(1);
      
      addResult(`✅ Quota calculation for owner ${quotaStatus.ownerId}:`);
      addResult(`   Tier: ${quotaStatus.tier}`);
      addResult(`   Total deficit: ${quotaStatus.totalDeficit}`);
      addResult(`   Deficits by screen/category:`);
      
      quotaStatus.deficits.forEach(deficit => {
        const categoryText = deficit.category ? `/${deficit.category}` : '';
        addResult(`     ${deficit.screen}${categoryText}: ${deficit.current}/${deficit.target} (deficit: ${deficit.deficit})`);
      });
      
      // Test cards to create
      const cardsToCreate = await PPLDataService.getCardsToCreate(1);
      addResult(`✅ Cards to create: ${cardsToCreate.length} types`);
      cardsToCreate.forEach(card => {
        const categoryText = card.category ? `/${card.category}` : '';
        addResult(`     ${card.screen}${categoryText}: ${card.count} cards`);
      });
      
    } catch (error) {
      addResult(`❌ Quota calculation error: ${error.message}`);
    }
  };

  const testTierConfigurations = async () => {
    try {
      addResult('Testing tier configurations...');
      
      // Test hard tier
      addResult(`✅ Hard tier categories: ${TIER_CONFIG.hard.categories.length}`);
      addResult(`   Named quota: ${TIER_CONFIG.hard.quotas.named} per category`);
      addResult(`   More quota: ${TIER_CONFIG.hard.quotas.more} per screen`);
      addResult(`   Total expected cards: ${TIER_CONFIG.hard.categories.length * TIER_CONFIG.hard.quotas.named + 3 * TIER_CONFIG.hard.quotas.more}`);
      
      // Test soft tier
      addResult(`✅ Soft tier categories: ${TIER_CONFIG.soft.categories.length}`);
      addResult(`   Named quota: ${TIER_CONFIG.soft.quotas.named} per category`);
      addResult(`   Total expected cards: ${TIER_CONFIG.soft.categories.length * TIER_CONFIG.soft.quotas.named}`);
      
      // Test base tier
      addResult(`✅ Base tier screens: ${TIER_CONFIG.base.screens.length}`);
      addResult(`   Screen quota: ${TIER_CONFIG.base.quotas.screen} per screen`);
      addResult(`   Total expected cards: ${TIER_CONFIG.base.screens.length * TIER_CONFIG.base.quotas.screen}`);
      
      // Test screen mapping
      addResult(`✅ Screen mapping:`);
      Object.entries(SCREEN_MAPPING).forEach(([screen, categories]) => {
        addResult(`   ${screen}: ${categories.join(', ')}`);
      });
      
    } catch (error) {
      addResult(`❌ Tier configuration error: ${error.message}`);
    }
  };

  const testDataSanitization = async () => {
    try {
      addResult('Testing data sanitization...');
      
      const dirtyText = '  This   is   a   test   with   extra   spaces   and   special   chars!@#$%^&*()  ';
      const cleanText = ValidationService.sanitizeText(dirtyText);
      
      addResult(`✅ Original: "${dirtyText}"`);
      addResult(`✅ Sanitized: "${cleanText}"`);
      
      // Test URL validation
      const validUrl = 'https://example.com/path';
      const invalidUrl = 'not-a-url';
      
      addResult(`✅ Valid URL: ${ValidationService.validateUrl(validUrl) ? 'PASSED' : 'FAILED'}`);
      addResult(`✅ Invalid URL: ${ValidationService.validateUrl(invalidUrl) ? 'FAILED' : 'PASSED'}`);
      
      // Test URL normalization
      const urlToNormalize = 'https://example.com/path?query=value#fragment';
      const normalizedUrl = ValidationService.normalizeUrl(urlToNormalize);
      addResult(`✅ URL normalization: ${urlToNormalize} -> ${normalizedUrl}`);
      
      // Test official source detection
      const officialUrl = 'https://ballotpedia.org/politician';
      const unofficialUrl = 'https://example.com/news';
      
      addResult(`✅ Official source: ${ValidationService.isOfficialSource(officialUrl) ? 'YES' : 'NO'}`);
      addResult(`✅ Unofficial source: ${ValidationService.isOfficialSource(unofficialUrl) ? 'NO' : 'YES'}`);
      
    } catch (error) {
      addResult(`❌ Data sanitization error: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    addResult('🚀 Starting Step 2 Data Models Tests...');
    
    await testDataValidation();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testTierConfigurations();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testDataSanitization();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testQuotaCalculation();
    
    addResult('✅ All Step 2 tests completed!');
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step 2: Data Models Test</Text>
      <Text style={styles.subtitle}>Testing TypeScript interfaces and validation</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Tests...' : 'Run Step 2 Tests'}
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



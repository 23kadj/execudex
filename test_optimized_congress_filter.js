// Test script to verify optimized congress filtering logic
// This can be run with: node test_optimized_congress_filter.js

// Helper function to generate congress value arrays for filtering (copied from implementation)
const generateCongressValues = (filterRange) => {
  const getOrdinalSuffix = (num) => {
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }
    
    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  switch (filterRange) {
    case '1st - 99th':
      return Array.from({ length: 99 }, (_, i) => `${i + 1}${getOrdinalSuffix(i + 1)}`);
    case '100th - 109th':
      return Array.from({ length: 10 }, (_, i) => `${100 + i}${getOrdinalSuffix(100 + i)}`);
    case '110th - 114th':
      return Array.from({ length: 5 }, (_, i) => `${110 + i}${getOrdinalSuffix(110 + i)}`);
    case '115th - Present':
      // Generate from 115th to current congress (119th) and beyond for future-proofing
      const currentCongress = 119; // This could be made dynamic based on current year
      return Array.from({ length: currentCongress - 114 }, (_, i) => `${115 + i}${getOrdinalSuffix(115 + i)}`);
    default:
      return [];
  }
};

console.log('Testing Optimized Congress Filtering Logic\n');
console.log('='.repeat(60));

// Test cases for each filter range
const testCases = [
  {
    filter: '1st - 99th',
    expectedCount: 99,
    expectedFirst: '1st',
    expectedLast: '99th',
    expectedSample: ['1st', '2nd', '3rd', '4th', '21st', '22nd', '23rd', '24th', '99th']
  },
  {
    filter: '100th - 109th',
    expectedCount: 10,
    expectedFirst: '100th',
    expectedLast: '109th',
    expectedSample: ['100th', '101st', '102nd', '103rd', '104th', '109th']
  },
  {
    filter: '110th - 114th',
    expectedCount: 5,
    expectedFirst: '110th',
    expectedLast: '114th',
    expectedSample: ['110th', '111th', '112th', '113th', '114th']
  },
  {
    filter: '115th - Present',
    expectedCount: 5, // 115th, 116th, 117th, 118th, 119th
    expectedFirst: '115th',
    expectedLast: '119th',
    expectedSample: ['115th', '116th', '117th', '118th', '119th']
  }
];

// Run tests
let allTestsPassed = true;

testCases.forEach(testCase => {
  console.log(`\nTesting filter: ${testCase.filter}`);
  console.log(`Expected count: ${testCase.expectedCount}`);
  console.log(`Expected range: ${testCase.expectedFirst} to ${testCase.expectedLast}`);
  
  const results = generateCongressValues(testCase.filter);
  
  console.log(`Actual count: ${results.length}`);
  console.log(`Actual range: ${results[0]} to ${results[results.length - 1]}`);
  console.log(`Sample values: [${testCase.expectedSample.join(', ')}]`);
  
  // Check count
  const countMatches = results.length === testCase.expectedCount;
  console.log(`Count match: ${countMatches ? '✅ PASS' : '❌ FAIL'}`);
  
  // Check first and last
  const firstMatches = results[0] === testCase.expectedFirst;
  const lastMatches = results[results.length - 1] === testCase.expectedLast;
  console.log(`Range match: ${firstMatches && lastMatches ? '✅ PASS' : '❌ FAIL'}`);
  
  // Check sample values are included
  const sampleMatches = testCase.expectedSample.every(expected => results.includes(expected));
  console.log(`Sample match: ${sampleMatches ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!countMatches || !firstMatches || !lastMatches || !sampleMatches) {
    allTestsPassed = false;
    console.log(`Full result array: [${results.slice(0, 10).join(', ')}${results.length > 10 ? '...' : ''}]`);
  }
  
  console.log('-'.repeat(50));
});

// Test ordinal suffix generation
console.log('\nOrdinal Suffix Generation Tests:');
console.log('='.repeat(40));

const ordinalTests = [
  { num: 1, expected: 'st' },
  { num: 2, expected: 'nd' },
  { num: 3, expected: 'rd' },
  { num: 4, expected: 'th' },
  { num: 11, expected: 'th' },
  { num: 12, expected: 'th' },
  { num: 13, expected: 'th' },
  { num: 21, expected: 'st' },
  { num: 22, expected: 'nd' },
  { num: 23, expected: 'rd' },
  { num: 24, expected: 'th' },
  { num: 101, expected: 'st' },
  { num: 102, expected: 'nd' },
  { num: 103, expected: 'rd' },
  { num: 104, expected: 'th' }
];

const getOrdinalSuffix = (num) => {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }
  
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

ordinalTests.forEach(test => {
  const result = getOrdinalSuffix(test.num);
  const passed = result === test.expected;
  console.log(`${test.num.toString().padEnd(3)} -> ${result} (expected: ${test.expected}) ${passed ? '✅' : '❌'}`);
  if (!passed) allTestsPassed = false;
});

console.log('\n' + '='.repeat(60));
console.log(`Overall Result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

// Performance test - generate all congress values
console.log('\nPerformance Test:');
console.log('='.repeat(30));

const startTime = Date.now();
const allCongressValues = [
  ...generateCongressValues('1st - 99th'),
  ...generateCongressValues('100th - 109th'),
  ...generateCongressValues('110th - 114th'),
  ...generateCongressValues('115th - Present')
];
const endTime = Date.now();

console.log(`Generated ${allCongressValues.length} congress values in ${endTime - startTime}ms`);
console.log(`First 10: [${allCongressValues.slice(0, 10).join(', ')}]`);
console.log(`Last 10: [${allCongressValues.slice(-10).join(', ')}]`);
console.log(`Performance: ${endTime - startTime < 10 ? '✅ FAST' : '⚠️  SLOW'}`);

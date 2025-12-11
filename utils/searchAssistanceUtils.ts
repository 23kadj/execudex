// Utility functions for search assistance feature
import { CardData } from './cardData';

// Common words to exclude from analysis (stop words)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'am', 'are', 'is', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'can', 'shall', 'ought', 'need', 'dare', 'used', 'from', 'into', 'onto', 'up', 'down',
  'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'now', 'about', 'above', 'below', 'between', 'among', 'through',
  'during', 'before', 'after', 'since', 'until', 'while', 'because', 'if', 'although',
  'though', 'unless', 'whether', 'while', 'whereas', 'wherever', 'whenever', 'whatever',
  'whoever', 'whichever', 'however', 'therefore', 'moreover', 'furthermore', 'nevertheless',
  'nonetheless', 'meanwhile', 'consequently', 'accordingly', 'thus', 'hence', 'indeed'
]);

// Function to clean and tokenize text
const tokenizeText = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word)); // Filter out short words and stop words
};

// Function to count word frequencies
const countWordFrequencies = (words: string[]): Map<string, number> => {
  const frequencies = new Map<string, number>();
  
  words.forEach(word => {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  });
  
  return frequencies;
};

// Function to get the most common words from card data
export const getMostCommonWords = (cards: CardData[], maxWords: number = 10): string[] => {
  if (!cards || cards.length === 0) return [];
  
  // Combine all titles and subtexts
  const allText = cards
    .map(card => `${card.title || ''} ${card.subtext || ''}`)
    .join(' ');
  
  // Tokenize the combined text
  const words = tokenizeText(allText);
  
  // Count word frequencies
  const wordFrequencies = countWordFrequencies(words);
  
  // Sort by frequency and return top words
  return Array.from(wordFrequencies.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
    .slice(0, maxWords)
    .map(([word]) => word);
};

// Function to filter cards based on selected words (requires ALL selected words to be present)
export const filterCardsByWords = (cards: CardData[], selectedWords: string[]): CardData[] => {
  if (!selectedWords || selectedWords.length === 0) return cards;
  
  return cards.filter(card => {
    const cardText = `${card.title || ''} ${card.subtext || ''}`.toLowerCase();
    // Use every() instead of some() to require ALL selected words to be present
    return selectedWords.every(word => cardText.includes(word.toLowerCase()));
  });
};

// Function to check if search assistance should be shown (more than 10 cards)
export const shouldShowSearchAssistance = (cards: CardData[]): boolean => {
  return cards && cards.length > 10;
};

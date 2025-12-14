import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CardLoadingIndicator } from '../../components/CardLoadingIndicator';
import { CardGenerationService } from '../../services/cardGenerationService';
import { CardService } from '../../services/cardService';
import { CardData, fetchCardsByScreen } from '../../utils/cardData';
import { incrementOpens } from '../../utils/incrementOpens7d';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Sub1({ scrollY, name, position, goToTab, index, scrollRef, cardRefreshTrigger }: { scrollY: Animated.Value; name: string; position: string; goToTab?: (idx: number) => void; index?: number; scrollRef?: React.RefObject<ScrollView>; cardRefreshTrigger?: number }) {
  const router = useRouter();
  
  // State for profile data
  const [tier, setTier] = useState<string>('');
  const [officeType, setOfficeType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // State for card data from card_index table
  const [cardData, setCardData] = useState<CardData[]>([]);
  const [isCardLoading, setIsCardLoading] = useState(false);
  
  // State for generate cards button
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const generateButtonScale = useRef(new Animated.Value(1)).current;
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentLoadingCardId = useRef<number | null>(null);


  
  // Fetch profile data from ppl_index
  useEffect(() => {
    const fetchProfileData = async () => {
      if (index) {
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('ppl_index')
            .select('tier, office_type')
            .eq('id', parseInt(index.toString()))
            .single();
          
          if (error) {
            console.error('Error fetching profile data:', error);
            setTier('base');
            setOfficeType('');
          } else if (data) {
            setTier((data as any).tier || '');
            setOfficeType((data as any).office_type || '');
          }
        } catch (err) {
          console.error('Error in fetchProfileData:', err);
          setTier('base');
          setOfficeType('');
        }
      }
      setIsLoading(false);
    };

    fetchProfileData();
  }, [index]);

  // Fetch card data from card_index table for preview card assignment
  useEffect(() => {
    const fetchCardDataFromDB = async () => {
      if (index) {
        try {
          const cards = await fetchCardsByScreen({
            ownerId: parseInt(index.toString()),
            isPpl: true,
            pageName: 'sub1',
            tier: tier
          });
          
          // Cards are already sorted by opens_7d descending and limited by tier
          setCardData(cards);
          
          // Check if generate button should be shown using new logic
          const shouldShow = await CardGenerationService.shouldShowGenerateButtonForPage(parseInt(index.toString()), 'sub1');
          setShowGenerateButton(shouldShow);
        } catch (error) {
          console.error('Error fetching card data:', error);
          setCardData([]);
          setShowGenerateButton(false);
        }
      }
    };

    fetchCardDataFromDB();
  }, [index, tier, cardRefreshTrigger]);

  // Handle cancel loading
  const handleCancelLoading = () => {
    // Cancel generate cards operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingCards(false);
    
    // Cancel individual card loading
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
    
    console.log('Card generation cancelled by user');
  };

  // Handle generate cards button press
  const handleGenerateCards = async () => {
    if (!index || isGeneratingCards) return;
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsGeneratingCards(true);
    try {
      const result = await CardGenerationService.generatePoliticianCards(
        parseInt(index.toString()), 
        'sub1'
      ) as any;
      
      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (result.success) {
        // Get number of cards generated
        const cardsGenerated = result.data?.inserted || 0;
        
        // Refresh cards after generation
        const cards = await fetchCardsByScreen({
          ownerId: parseInt(index.toString()),
          isPpl: true,
          pageName: 'sub1',
          tier: tier
        });
        setCardData(cards);
        
        // Check if button should still be shown using new logic
        const shouldShow = await CardGenerationService.shouldShowGenerateButtonForPage(parseInt(index.toString()), 'sub1');
        setShowGenerateButton(shouldShow);
        
        // Show success message
        Alert.alert(
          'Success',
          `Generated ${cardsGenerated} card${cardsGenerated !== 1 ? 's' : ''} successfully!`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      // Don't log error if it was an abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Card generation aborted');
        return;
      }
      console.error('Error generating cards:', error);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsGeneratingCards(false);
      }
      abortControllerRef.current = null;
    }
  };

  // Determine layout based on tier and office_type
  const getLayoutConfig = () => {
    // Tier-based rules (highest priority)
    if (tier === 'base') {
      return {
        cardCount: 4,
        gridType: 'soft', // 2x2 grid like soft tier
        showMoreSelections: false
      };
    }
    
    if (tier === 'soft') {
      return {
        cardCount: 4,
        gridType: 'soft', // 4 preview cards + 2x2 grid like legi1
        showMoreSelections: false
      };
    }
    
    if (tier === 'hard') {
      return {
        cardCount: 3,
        gridType: 'hard', // Original 7-button grid layout
        showMoreSelections: true
      };
    }
    
    // Office type-based rules (fallback when tier is not set)
    if (officeType === 'candidate') {
      return {
        cardCount: 10,
        gridType: 'none',
        showMoreSelections: false
      };
    }
    
    if (officeType === 'mayor') {
      return {
        cardCount: 4,
        gridType: 'mayor',
        showMoreSelections: false
      };
    }
    
    if (officeType === 'cabinet') {
      return {
        cardCount: 3,
        gridType: 'cabinet',
        showMoreSelections: false
      };
    }
    
    // Default layout for president, vice president, senator, governor, representative
    if (['president', 'vice president', 'senator', 'governor', 'representative'].includes(officeType)) {
      return {
        cardCount: 3,
        gridType: 'default',
        showMoreSelections: true
      };
    }
    
    // Fallback to base tier
    return {
      cardCount: 10,
      gridType: 'none',
      showMoreSelections: false
    };
  };

  const layoutConfig = getLayoutConfig();
  
  // Animated scale values for cards and buttons
  const card1Scale = useRef(new Animated.Value(1)).current;
  const card2Scale = useRef(new Animated.Value(1)).current;
  const card3Scale = useRef(new Animated.Value(1)).current;
  const card4Scale = useRef(new Animated.Value(1)).current;
  const card5Scale = useRef(new Animated.Value(1)).current;
  const card6Scale = useRef(new Animated.Value(1)).current;
  const card7Scale = useRef(new Animated.Value(1)).current;
  const card8Scale = useRef(new Animated.Value(1)).current;
  const card9Scale = useRef(new Animated.Value(1)).current;
  const card10Scale = useRef(new Animated.Value(1)).current;
  
  const gridButton1Scale = useRef(new Animated.Value(1)).current;
  const gridButton2Scale = useRef(new Animated.Value(1)).current;
  const gridButton3Scale = useRef(new Animated.Value(1)).current;
  const gridButton4Scale = useRef(new Animated.Value(1)).current;
  const gridButton5Scale = useRef(new Animated.Value(1)).current;
  const gridButton6Scale = useRef(new Animated.Value(1)).current;
  const gridButtonFullScale = useRef(new Animated.Value(1)).current;


  const handleGridButtonPress = (buttonText: string) => {
    router.push({
      pathname: '/profile/sub4',
      params: { 
        buttonText,
        title: position,
        subtitle: name,
        originalPage: 'sub1',
        profileIndex: index?.toString() || ''
      }
    });
  };

  // Render cards based on layout config
  const renderCards = () => {
    const cards = [];
    const cardScales = [card1Scale, card2Scale, card3Scale, card4Scale, card5Scale, card6Scale, card7Scale, card8Scale, card9Scale, card10Scale];
    
    // Only render cards for which we have data
    for (let i = 0; i < Math.min(layoutConfig.cardCount, cardData.length); i++) {
      const cardNumber = i + 1;
      // Use a fallback animated value for cards beyond the first 10
      const cardScale = i < cardScales.length ? cardScales[i] : card1Scale;
      
      // Get styles safely with fallbacks
      const getCardStyle = (number: number) => {
        // For cards beyond 10, use card1 style as fallback
        const styleNumber = Math.min(number, 10);
        switch (styleNumber) {
          case 1: return styles.card1;
          case 2: return styles.card2;
          case 3: return styles.card3;
          case 4: return styles.card4;
          case 5: return styles.card5;
          case 6: return styles.card6;
          case 7: return styles.card7;
          case 8: return styles.card8;
          case 9: return styles.card9;
          case 10: return styles.card10;
          default: return styles.card1;
        }
      };
      
      const getTitleRowStyle = (number: number) => {
        const styleNumber = Math.min(number, 10);
        switch (styleNumber) {
          case 1: return styles.titleRow1;
          case 2: return styles.titleRow2;
          case 3: return styles.titleRow3;
          case 4: return styles.titleRow4;
          case 5: return styles.titleRow5;
          case 6: return styles.titleRow6;
          case 7: return styles.titleRow7;
          case 8: return styles.titleRow8;
          case 9: return styles.titleRow9;
          case 10: return styles.titleRow10;
          default: return styles.titleRow1;
        }
      };
      
      const getTitleStyle = (number: number) => {
        const styleNumber = Math.min(number, 10);
        switch (styleNumber) {
          case 1: return styles.title1;
          case 2: return styles.title2;
          case 3: return styles.title3;
          case 4: return styles.title4;
          case 5: return styles.title5;
          case 6: return styles.title6;
          case 7: return styles.title7;
          case 8: return styles.title8;
          case 9: return styles.title9;
          case 10: return styles.title10;
          default: return styles.title1;
        }
      };
      
      const getSubtextStyle = (number: number) => {
        const styleNumber = Math.min(number, 10);
        switch (styleNumber) {
          case 1: return styles.subtext1;
          case 2: return styles.subtext2;
          case 3: return styles.subtext3;
          case 4: return styles.subtext4;
          case 5: return styles.subtext5;
          case 6: return styles.subtext6;
          case 7: return styles.subtext7;
          case 8: return styles.subtext8;
          case 9: return styles.subtext9;
          case 10: return styles.subtext10;
          default: return styles.subtext1;
        }
      };
      
      cards.push(
        <AnimatedPressable
          key={`card${cardNumber}`}
          onPressIn={() => {
            Haptics.selectionAsync();
            Animated.spring(cardScale, {
              toValue: 0.95,
              friction: 6,
              useNativeDriver: true,
            }).start();
          }}
          onPressOut={() => {
            Animated.spring(cardScale, {
              toValue: 1,
              friction: 6,
              useNativeDriver: true,
            }).start();
          }}
          onPress={async () => {
            const cardId = String(cardData[cardNumber - 1]?.id || '');
            if (cardId) {
              // Validate cardId is a valid number before parsing
              const parsedCardId = parseInt(cardId, 10);
              if (isNaN(parsedCardId) || parsedCardId <= 0) {
                console.error('Invalid cardId:', cardId);
                return;
              }
              
              incrementOpens(cardId);
              
              // Track the currently loading card
              currentLoadingCardId.current = parsedCardId;
              
              // Execute full_card_gen script
              let wasCancelled = false;
              try {
                await CardService.generateFullCard(parsedCardId, setIsCardLoading);
              } catch (error: any) {
                if (error?.message === 'CANCELLED') {
                  console.log('Card loading was cancelled, not navigating');
                  wasCancelled = true;
                } else {
                  console.error('Error generating full card:', error);
                  // Continue with navigation even if card generation fails (non-cancellation error)
                }
              } finally {
                currentLoadingCardId.current = null;
              }
              
              // Only navigate if not cancelled
              if (wasCancelled) {
                return;
              }
            }
            router.push({
              pathname: '/profile/sub5',
              params: { 
                cardTitle: cardData[cardNumber - 1]?.title || `Card ${cardNumber}`,
                profileName: name,
                sourcePage: 'sub1',
                pageCount: String(1),
                cardId: cardId
              }
            });
          }}
          style={[
            getCardStyle(cardNumber),
            { transform: [{ scale: cardScale }] }
          ]}
        >
          <View style={getTitleRowStyle(cardNumber)}>
            <Text style={getTitleStyle(cardNumber)}>
              {cardData[cardNumber - 1]?.title || `Card ${cardNumber} Title`}
            </Text>
          </View>
          <Text style={getSubtextStyle(cardNumber)}>
            {cardData[cardNumber - 1]?.subtext || `Card ${cardNumber} subtitle text`}
          </Text>
          

        </AnimatedPressable>
      );
    }
    
    return cards;
  };

  // Render grid based on layout config
  const renderGrid = () => {
    if (layoutConfig.gridType === 'none') {
      return null;
    }
    
    if (layoutConfig.gridType === 'soft') {
      // 4-button grid like legi1 (4 preview cards + 2x2 grid)
      return (
        <View style={styles.softGridContainer}>
          <View style={styles.softGridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton1Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton1Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Economy')}
              style={[
                styles.gridButton1,
                { transform: [{ scale: gridButton1Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText1}>Economy</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton2Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton2Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Social Programs')}
              style={[
                styles.gridButton2,
                { transform: [{ scale: gridButton2Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText2}>Social Programs</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.softGridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton3Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton3Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Immigration')}
              style={[
                styles.gridButton3,
                { transform: [{ scale: gridButton3Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText3}>Immigration</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton4Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton4Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('National Security')}
              style={[
                styles.gridButton4,
                { transform: [{ scale: gridButton4Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText4}>National Security</Text>
            </AnimatedPressable>
          </View>
        </View>
      );
    }
    
    if (layoutConfig.gridType === 'hard') {
      // Original 7-button grid layout
      return (
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton1Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton1Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Economy')}
              style={[
                styles.gridButton1,
                { transform: [{ scale: gridButton1Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText1}>Economy</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton2Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton2Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Healthcare')}
              style={[
                styles.gridButton2,
                { transform: [{ scale: gridButton2Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText2}>Healthcare</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton3Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton3Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Immigration')}
              style={[
                styles.gridButton3,
                { transform: [{ scale: gridButton3Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText3}>Immigration</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton4Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton4Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Defense')}
              style={[
                styles.gridButton4,
                { transform: [{ scale: gridButton4Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText4}>Defense</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton5Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton5Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Environment')}
              style={[
                styles.gridButton5,
                { transform: [{ scale: gridButton5Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText5}>Environment</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton6Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton6Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Education')}
              style={[
                styles.gridButton6,
                { transform: [{ scale: gridButton6Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText6}>Education</Text>
            </AnimatedPressable>
          </View>
          {layoutConfig.showMoreSelections && (
            <View style={styles.gridRowFull}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(gridButtonFullScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(gridButtonFullScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => handleGridButtonPress('More Selections')}
                style={[
                  styles.gridButtonFull,
                  { transform: [{ scale: gridButtonFullScale }] }
                ]}
              >
                <Text style={styles.gridButtonFullText}>More Selections</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>
      );
    }
    
    if (layoutConfig.gridType === 'mayor') {
      // 4-button grid like legi1
      return (
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton1Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton1Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Action')}
              style={[
                styles.gridButton1,
                { transform: [{ scale: gridButton1Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText1}>Action</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton2Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton2Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Scope')}
              style={[
                styles.gridButton2,
                { transform: [{ scale: gridButton2Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText2}>Scope</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton3Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton3Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Process')}
              style={[
                styles.gridButton3,
                { transform: [{ scale: gridButton3Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText3}>Process</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton4Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton4Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Impact')}
              style={[
                styles.gridButton4,
                { transform: [{ scale: gridButton4Scale }] }
              ]}
            >
              <Text style={styles.gridButtonText4}>Impact</Text>
            </AnimatedPressable>
          </View>
        </View>
      );
    }
    
    if (layoutConfig.gridType === 'cabinet') {
      // 2-button layout for cabinet
      return (
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton1Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton1Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Cabinet Action 1')}
              style={[
                styles.cabinetButton1,
                { transform: [{ scale: gridButton1Scale }] }
              ]}
            >
              <Text style={styles.cabinetButtonText}>Cabinet Action 1</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButton2Scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButton2Scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Cabinet Action 2')}
              style={[
                styles.cabinetButton2,
                { transform: [{ scale: gridButton2Scale }] }
              ]}
            >
              <Text style={styles.cabinetButtonText}>Cabinet Action 2</Text>
            </AnimatedPressable>
          </View>
        </View>
      );
    }
    
    // Default 6x2 grid
    return (
      <View style={styles.gridContainer}>
        <View style={styles.gridRow}>
          <AnimatedPressable
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(gridButton1Scale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(gridButton1Scale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPress={() => handleGridButtonPress('No Data')}
            style={[
              styles.gridButton1,
              { transform: [{ scale: gridButton1Scale }] }
            ]}
          >
            <Text style={styles.gridButtonText1}>No Data</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(gridButton2Scale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(gridButton2Scale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPress={() => handleGridButtonPress('No Data')}
            style={[
              styles.gridButton2,
              { transform: [{ scale: gridButton2Scale }] }
            ]}
          >
            <Text style={styles.gridButtonText2}>No Data</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.gridRow}>
          <AnimatedPressable
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(gridButton3Scale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(gridButton3Scale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPress={() => handleGridButtonPress('No Data')}
            style={[
              styles.gridButton3,
              { transform: [{ scale: gridButton3Scale }] }
            ]}
          >
            <Text style={styles.gridButtonText3}>No Data</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(gridButton4Scale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(gridButton4Scale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPress={() => handleGridButtonPress('No Data')}
            style={[
              styles.gridButton4,
              { transform: [{ scale: gridButton4Scale }] }
            ]}
          >
            <Text style={styles.gridButtonText4}>No Data</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.gridRow}>
          <AnimatedPressable
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(gridButton5Scale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(gridButton5Scale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPress={() => handleGridButtonPress('No Data')}
            style={[
              styles.gridButton5,
              { transform: [{ scale: gridButton5Scale }] }
            ]}
          >
            <Text style={styles.gridButtonText5}>No Data</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(gridButton6Scale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(gridButton6Scale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPress={() => handleGridButtonPress('No Data')}
            style={[
              styles.gridButton6,
              { transform: [{ scale: gridButton6Scale }] }
            ]}
          >
            <Text style={styles.gridButtonText6}>No Data</Text>
          </AnimatedPressable>
        </View>
        {layoutConfig.showMoreSelections && (
          <View style={styles.gridRowFull}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButtonFullScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButtonFullScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('More Selections')}
              style={[
                styles.gridButtonFull,
                { transform: [{ scale: gridButtonFullScale }] }
              ]}
            >
              <Text style={styles.gridButtonFullText}>More Selections</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ flex: 1, width: '100%' }}
      contentContainerStyle={{ width: '100%' }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      )}
    >
      <View style={styles.container}>
        {renderGrid()}
        {renderCards()}
        
        {/* Generate New Cards Button */}
        {showGenerateButton && (
          <View style={styles.generateButtonContainer}>
            <Animated.View style={{ transform: [{ scale: generateButtonScale }] }}>
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(generateButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(generateButtonScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={handleGenerateCards}
                disabled={isGeneratingCards}
                style={[
                  styles.generateButton,
                  isGeneratingCards && styles.generateButtonDisabled
                ]}
              >
                <Text style={[
                  styles.generateButtonText,
                  isGeneratingCards && styles.generateButtonTextDisabled
                ]}>
                  {isGeneratingCards ? 'Generating...' : 'Generate New Cards'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
      
      <CardLoadingIndicator 
        visible={isCardLoading || isGeneratingCards} 
        onCancel={handleCancelLoading}
      />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: '#000',
    alignItems: 'stretch',
  },
  // Card 1 styles
  card1: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title1: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext1: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 2 styles
  card2: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title2: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext2: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 3 styles
  card3: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title3: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext3: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 4 styles
  card4: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow4: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title4: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext4: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 5 styles
  card5: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow5: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title5: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext5: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 6 styles
  card6: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow6: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title6: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext6: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 7 styles
  card7: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow7: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title7: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext7: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 8 styles
  card8: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow8: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title8: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext8: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 9 styles
  card9: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow9: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title9: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext9: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  // Card 10 styles
  card10: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow10: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title10: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext10: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  gridContainer: {
    backgroundColor: '#040404',
    borderColor: '#101010',
    borderWidth: 1,
    width: '95%',
    alignSelf: 'center',
    borderRadius: 32,
    height: 295,
    marginTop: 0,
    marginBottom: 15,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  // Soft tier grid container (like legi1)
  softGridContainer: {
    backgroundColor: '#040404',
    borderColor: '#101010',
    borderWidth: 1,
    width: '95%',
    alignSelf: 'center',
    borderRadius: 32,
    height: 158,
    marginTop: 0,
    marginBottom: 15,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: 'center',
  },

  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 0,
    paddingHorizontal: 0,
  },
  softGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    marginTop: 5,
    paddingHorizontal: 0,
  },
  gridButton1: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton2: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton3: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton4: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton5: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton6: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButtonText1: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText3: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText4: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText5: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText6: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridRowFull: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 0,
    paddingHorizontal: 0,
  },
  gridButtonFull: {
    backgroundColor: '#090909',
    borderRadius: 15,
    marginTop: 0,
    marginBottom: 5,
    height: 54,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 50,
  },
  cabinetButton1: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinetButton2: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  generateButtonContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 30,
  },
  generateButton: {
    backgroundColor: '#050505',
    borderRadius: 20,
    borderColor: '#101010',
    borderWidth: 1,
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  generateButtonTextDisabled: {
    color: '#999',
  },


});

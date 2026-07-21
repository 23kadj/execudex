import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import CardLoadingIndicator from '../components/CardLoadingIndicator';
import { getSupabaseClient } from '../utils/supabase';

type QAEntry = { id: number; card_id: number; question: string; answer: string };

// --- Q&A card border radius scale (edit these to adjust) ---
const QA_BORDER_RADIUS_MIN = 20;
const QA_BORDER_RADIUS_MAX = 20;
const QA_BORDER_RADIUS_SCALE = 0.125; // borderRadius = height * scale, clamped to min/max

export default function CardQuestions() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [questionText, setQuestionText] = useState('');
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qaHeights, setQaHeights] = useState<Record<number, number>>({});

  const handleQALayout = useCallback((entryId: number) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setQaHeights((prev) => (prev[entryId] === h ? prev : { ...prev, [entryId]: h }));
  }, []);

  const getQABorderRadius = useCallback((entryId: number) => {
    const h = qaHeights[entryId] ?? 80;
    const raw = h * QA_BORDER_RADIUS_SCALE;
    return Math.min(QA_BORDER_RADIUS_MAX, Math.max(QA_BORDER_RADIUS_MIN, raw));
  }, [qaHeights]);

  // Extract cardId - handle both string and array (Expo Router can pass params as arrays)
  const rawCardId = params.cardId;
  const cardId = typeof rawCardId === 'string'
    ? rawCardId
    : Array.isArray(rawCardId) && rawCardId[0]
      ? String(rawCardId[0])
      : undefined;

  const questionInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!cardId) {
      console.log('[CardQuestions] No cardId in params:', { params: JSON.stringify(params) });
      return;
    }
    const parsed = parseInt(cardId, 10);
    if (isNaN(parsed)) {
      console.log('[CardQuestions] Invalid cardId (not a number):', cardId);
      return;
    }
    console.log('[CardQuestions] Fetching Q&A for cardId:', cardId, 'parsed:', parsed);
    const fetchQA = async () => {
      try {
        const supabase = getSupabaseClient();
        // Try matching card_id as integer first
        let { data, error } = await supabase
          .from('questions')
          .select('id, card_id, question, answer')
          .eq('card_id', parsed)
          .order('id', { ascending: false });
        // If no results and column might be text, try string match
        if (!error && (!data || data.length === 0)) {
          const res = await supabase
            .from('questions')
            .select('id, card_id, question, answer')
            .eq('card_id', cardId)
            .order('id', { ascending: false });
          data = res.data;
          error = res.error;
        }
        if (error) {
          console.log('[CardQuestions] Supabase error:', error.message, error.code);
          return;
        }
        if (!data) {
          console.log('[CardQuestions] No data returned');
          return;
        }
        console.log('[CardQuestions] Fetched', data.length, 'Q&A entries');
        setQaEntries(data as QAEntry[]);
      } catch (err) {
        console.log('[CardQuestions] Fetch error:', err);
      }
    };
    fetchQA();
  }, [cardId]);

  const handleSubmit = async () => {
    if (!questionText.trim() || !user?.id || !cardId) return;
    const trimmed = questionText.trim();
    setIsSubmitting(true);
    setQuestionText('');
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('card-questions', {
        body: { question: trimmed, card_id: parseInt(cardId, 10) },
      });
      const result = data as { success?: boolean; fail?: boolean; id?: number; question?: string; answer?: string; created_at?: string } | null;
      if (error || !result?.success || result.fail) {
        Alert.alert(
          "Your question could not be answered, we apologize for the inconvenience."
        );
        return;
      }
      setQaEntries((prev) => [
        {
          id: result.id!,
          card_id: parseInt(cardId, 10),
          question: result.question ?? trimmed,
          answer: result.answer ?? '',
        },
        ...prev,
      ]);
    } catch {
      Alert.alert(
        "Your question could not be answered, we apologize for the inconvenience."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    questionInputRef.current?.blur();
  }, []);

  const handleScreenPress = useCallback(() => {
    dismissKeyboard();
  }, [dismissKeyboard]);

  const characterCount = questionText.length;
  const isAtLimit = characterCount === 200;
  const isNearLimit = characterCount >= 150;

  let counterColor = '#fff';
  if (isAtLimit) counterColor = '#ff0000';
  else if (isNearLimit) counterColor = '#ffff00';

  const hasAnyQA = qaEntries.length > 0;

  return (
    <View style={styles.container}>
      {/* Header - blank with only back button */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Text Box */}
            <View style={styles.textBoxContainer}>
              <TextInput
                ref={questionInputRef}
                style={[
                  styles.textInput,
                  isSubmitting && styles.textInputDisabled
                ]}
                placeholder="Enter your question here"
                placeholderTextColor="#666"
                value={String(questionText ?? '')}
                onChangeText={(text) => setQuestionText(String(text ?? ''))}
                multiline
                maxLength={200}
                editable={!isSubmitting}
                textAlignVertical="top"
                keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
                blurOnSubmit={false}
              />
            </View>

            {/* Character Counter + Submit Button Row */}
            <View style={styles.counterSubmitRow}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonSubmitted,
                  !user?.id && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || !user?.id}
                activeOpacity={0.7}
              >
                <Text style={styles.submitButtonText}>
                  {!user?.id ? 'Please Sign In' : isSubmitting ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.characterCounter, { color: counterColor }]}>
                {characterCount}/200
              </Text>
            </View>
          </View>

          {hasAnyQA ? (
            <>
              {qaEntries.map((entry) => (
                <View
                  key={entry.id}
                  style={[
                    styles.qaGridContainer,
                    { borderRadius: getQABorderRadius(entry.id) },
                  ]}
                  onLayout={handleQALayout(entry.id)}
                >
                  <Text style={styles.qaTitle1}>{entry.question || 'No question'}</Text>
                  <Text style={styles.qaInfo1}>{entry.answer || 'No answer'}</Text>
                  <Text style={styles.qaAnsweredBy}>Answered by Execudex</Text>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.sectionHeader}>
              <Text style={styles.emptyStateText}>No Q & A responses are currently available, be the first to ask a question.</Text>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

      <CardLoadingIndicator
        visible={isSubmitting}
        title="Answering your question"
        subtitle="Please keep the app open as we answer your question."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    paddingTop: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 100,
  },
  headerIconBtn: {
    padding: 8,
    marginHorizontal: 2,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  textBoxContainer: {
    height: 200,
    marginBottom: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#050505',
    borderRadius: 16,
    padding: 20,
    paddingTop: 10,
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
  },
  textInputDisabled: {
    backgroundColor: '#333',
    color: '#999',
  },
  counterSubmitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  characterCounter: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: '85%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonSubmitted: {
    backgroundColor: '#333',
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  qaAnsweredBy: {
    color: '#8a8a8a',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'left',
    marginTop: 12,
  },
  qaGridContainer: {
    backgroundColor: '#050505',
    width: '95%',
    alignSelf: 'center',
    borderColor: '#101010',
    borderWidth: 1,
    // borderRadius set dynamically via inline style (see QA_BORDER_RADIUS_* constants)
    marginTop: 5,
    marginBottom: 5,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  qaTitle1: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'left',
    marginBottom: 15,
  },
  qaInfo1: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'left',
  },
});

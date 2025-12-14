import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Image, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { getSupabaseClient } from '../utils/supabase';

export default function Feedback() {
  const router = useRouter();
  const { user } = useAuth();
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  // Debug logging for user authentication
  console.log('Feedback component - User authentication status:', {
    isAuthenticated: !!user,
    userId: user?.id,
    userEmail: user?.email
  });

  // Ref for feedback input to handle keyboard dismissal
  const feedbackInputRef = useRef<TextInput>(null);


  const handleSubmit = async () => {
    // Only submit if there's text to submit
    if (!feedbackText.trim()) {
      return;
    }

    // Check if user is authenticated
    if (!user?.id) {
      console.error('User not authenticated, cannot submit feedback');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      
      // Insert feedback into the feedback table with user_id and created_at
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          comment: feedbackText.trim(),
          user_id: user.id,
          created_at: timestamp
        })
        .select();

      if (error) {
        console.error('Error inserting feedback:', error);
      } else {
        console.log('Feedback inserted successfully:', data);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }

    // Update UI state
    setIsSubmitted(true);
    setIsDisabled(true);
    
    // Lock input for cooldown period
    setTimeout(() => {
      setIsDisabled(false);
      setIsSubmitted(false);
      setFeedbackText('');
    }, 5000); // 5 second cooldown
  };

  // Keyboard dismissal functions
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    feedbackInputRef.current?.blur();
  }, []);

  const handleScreenPress = useCallback(() => {
    dismissKeyboard();
  }, [dismissKeyboard]);

  const characterCount = feedbackText.length;
  const isAtLimit = characterCount === 200;
  const isNearLimit = characterCount >= 100;

  // Character counter color logic
  let counterColor = '#fff'; // Default: normal color
  if (isAtLimit) {
    counterColor = '#ff0000'; // Red at exactly 200 characters
  } else if (isNearLimit) {
    counterColor = '#ffff00'; // Yellow at 100+ characters
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
      </View>
      
      {/* Content */}
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <View style={styles.content}>
          {/* Feedback Text Box */}
          <View style={styles.textBoxContainer}>
            <TextInput
              ref={feedbackInputRef}
              style={[
                styles.textInput,
                isSubmitted && styles.textInputDisabled
              ]}
              placeholder="Enter your feedback here..."
              placeholderTextColor="#666"
              value={String(feedbackText ?? '')}
              onChangeText={(text) => setFeedbackText(String(text ?? ''))}
              multiline
              maxLength={200}
              editable={!isSubmitted && !isDisabled}
              textAlignVertical="top"
              keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
              blurOnSubmit={false}
            />
          </View>

          {/* Character Counter */}
          <View style={styles.counterContainer}>
            <Text style={[styles.characterCounter, { color: counterColor }]}>
              {characterCount}/200
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitted && styles.submitButtonSubmitted,
              !user?.id && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={isSubmitted || isDisabled || !user?.id}
            activeOpacity={0.7}
          >
            <Text style={styles.submitButtonText}>
              {!user?.id ? 'Please Sign In' : isSubmitted ? 'Submitted' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },

  content: {
    flex: 1,
    paddingTop: 100, // Leave space for header
    paddingHorizontal: 20,
  },
  // HEADER - identical to sub4.tsx
  headerContainer: {
    position: 'absolute',
    top: 30, // edit this to move header up/down
    left: 0,
    right: 0,
    height: 60,
    paddingTop: 16,
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
  // HEADER TITLE - identical to bookmarks.tsx
  headerTitle: {
    position: 'absolute',
    marginTop: 20,
    left: 0,
    right: 0,
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  // TEXT BOX - fixed large size to accommodate maximum text
  textBoxContainer: {
    height: 200, // Fixed height that can fit maximum 200 characters comfortably
    marginBottom: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#050505',
    borderRadius: 16,
    padding: 20,
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
  // CHARACTER COUNTER
  counterContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  characterCounter: {
    fontSize: 14,
    fontWeight: '500',
  },
  // SUBMIT BUTTON
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 40,
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
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Action() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const actionsRaw = typeof params.actions === 'string' ? params.actions : '';

  const actions = useMemo(() => {
    if (!actionsRaw) return [];

    return actionsRaw
      .split('|')
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => {
        const colonIndex = entry.indexOf(':');
        if (colonIndex === -1) {
          return {
            date: entry,
            description: '',
          };
        }

        const date = entry.slice(0, colonIndex).trim();
        const description = entry.slice(colonIndex + 1).trim();

        return { date, description };
      })
      .filter(item => item.date || item.description);
  }, [actionsRaw]);

  return (
    <View style={styles.container}>
      {/* Header with back button only */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {actions.map((action, index) => (
          <View key={`${action.date}-${index}`} style={styles.actionBox}>
            <Text style={styles.boxTitle}>{action.date}</Text>
            {!!action.description && (
              <Text style={styles.boxContent}>{action.description}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    height: 80,
    paddingTop: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
  },
  actionBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  boxTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'left',
  },
  boxContent: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'left',
  },
});


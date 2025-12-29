import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { SearchFilterButton } from '../components/SearchFilterButton';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Valid US state codes
const validStateCodes = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC' // District of Columbia
];

// Validate state code
const isValidStateCode = (code: string) => {
  if (code.length === 0) return true; // Empty is valid (optional field)
  if (code.length !== 2) return false;
  return validStateCodes.includes(code.toUpperCase());
};

// Parse onboard data string
const parseOnboardData = (onboardData: string | null) => {
  const data: Record<string, string> = {};
  if (!onboardData) return data;

  const parts = onboardData.split(' | ');
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const key = part.substring(0, colonIndex).trim();
      const value = part.substring(colonIndex + 1).trim();
      data[key] = value;
    }
  }
  return data;
};

export default function Demographics() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State variables
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [stateCode, setStateCode] = useState<string>('');
  const [politicalStanding, setPoliticalStanding] = useState<string>('');
  const [educationLevel, setEducationLevel] = useState<string>('');
  const [employmentStatus, setEmploymentStatus] = useState<string[]>([]);
  const [incomeLevel, setIncomeLevel] = useState<string>('');
  const [raceEthnicity, setRaceEthnicity] = useState<string>('');
  const [dependentStatus, setDependentStatus] = useState<string>('');
  const [militaryStatus, setMilitaryStatus] = useState<string>('');
  const [immigrationStatus, setImmigrationStatus] = useState<string>('');
  const [governmentBenefits, setGovernmentBenefits] = useState<string[]>([]);
  const [sexualOrientation, setSexualOrientation] = useState<string>('');
  const [voterEligibility, setVoterEligibility] = useState<string>('');
  const [disabilityStatus, setDisabilityStatus] = useState<string[]>([]);
  const [industryOfWork, setIndustryOfWork] = useState<string[]>([]);
  const [additionalInformation, setAdditionalInformation] = useState<string>('');

  // Fetch user's onboard data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('users')
          .select('onboard')
          .eq('uuid', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user data:', error);
          setLoading(false);
          return;
        }

        if (data?.onboard) {
          const parsed = parseOnboardData(data.onboard);
          
          // Set state from parsed data
          if (parsed['Age']) setAge(parsed['Age']);
          if (parsed['Gender']) setGender(parsed['Gender']);
          if (parsed['State Code']) setStateCode(parsed['State Code']);
          if (parsed['Political Standing']) setPoliticalStanding(parsed['Political Standing']);
          if (parsed['Highest Education Level']) setEducationLevel(parsed['Highest Education Level']);
          if (parsed['Employment Status']) setEmploymentStatus(parsed['Employment Status'].split(', ').filter(Boolean));
          if (parsed['Income Level']) setIncomeLevel(parsed['Income Level']);
          if (parsed['Race & Ethnicity']) setRaceEthnicity(parsed['Race & Ethnicity']);
          if (parsed['Dependent Status']) setDependentStatus(parsed['Dependent Status']);
          if (parsed['Military Status']) setMilitaryStatus(parsed['Military Status']);
          if (parsed['Immigration Status']) setImmigrationStatus(parsed['Immigration Status']);
          if (parsed['Government Benefits']) setGovernmentBenefits(parsed['Government Benefits'].split(', ').filter(Boolean));
          if (parsed['Sexual Orientation']) setSexualOrientation(parsed['Sexual Orientation']);
          if (parsed['Voter Eligibility']) setVoterEligibility(parsed['Voter Eligibility']);
          if (parsed['Disability Status']) setDisabilityStatus(parsed['Disability Status'].split(', ').filter(Boolean));
          if (parsed['Industry of Work or Study']) setIndustryOfWork(parsed['Industry of Work or Study'].split(', ').filter(Boolean));
          if (parsed['Additional Information']) setAdditionalInformation(parsed['Additional Information']);
        }
      } catch (error) {
        console.error('Exception fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  // Build onboard data string
  const buildOnboardData = () => {
    const parts: string[] = [];
    
    // Demographic indicators section
    if (age) parts.push(`Age: ${age}`);
    if (gender) parts.push(`Gender: ${gender}`);
    if (stateCode) parts.push(`State Code: ${stateCode}`);
    if (politicalStanding) parts.push(`Political Standing: ${politicalStanding}`);
    if (educationLevel) parts.push(`Highest Education Level: ${educationLevel}`);
    if (employmentStatus.length > 0) parts.push(`Employment Status: ${employmentStatus.join(', ')}`);
    if (incomeLevel) parts.push(`Income Level: ${incomeLevel}`);
    if (raceEthnicity) parts.push(`Race & Ethnicity: ${raceEthnicity}`);
    if (dependentStatus) parts.push(`Dependent Status: ${dependentStatus}`);
    if (militaryStatus) parts.push(`Military Status: ${militaryStatus}`);
    if (immigrationStatus) parts.push(`Immigration Status: ${immigrationStatus}`);
    if (governmentBenefits.length > 0) parts.push(`Government Benefits: ${governmentBenefits.join(', ')}`);
    if (sexualOrientation) parts.push(`Sexual Orientation: ${sexualOrientation}`);
    if (voterEligibility) parts.push(`Voter Eligibility: ${voterEligibility}`);
    if (disabilityStatus.length > 0) parts.push(`Disability Status: ${disabilityStatus.join(', ')}`);
    if (industryOfWork.length > 0) parts.push(`Industry of Work or Study: ${industryOfWork.join(', ')}`);
    if (additionalInformation) parts.push(`Additional Information: ${additionalInformation}`);
    
    return parts.join(' | ');
  };

  // Save changes
  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const onboardData = buildOnboardData();

      // Get existing onboard data to preserve non-demographic fields
      const { data: existingData } = await supabase
        .from('users')
        .select('onboard')
        .eq('uuid', user.id)
        .maybeSingle();

      let finalOnboardData = onboardData;
      
      // If there's existing data, merge it (preserve original onboarding questions)
      if (existingData?.onboard) {
        const existingParts = existingData.onboard.split(' | ');
        const demographicKeys = [
          'Age', 'Gender', 'State Code', 'Political Standing', 'Highest Education Level', 'Employment Status',
          'Income Level', 'Race & Ethnicity', 'Dependent Status', 'Military Status',
          'Immigration Status', 'Government Benefits', 'Sexual Orientation', 'Voter Eligibility',
          'Disability Status', 'Industry of Work or Study', 'Additional Information'
        ];
        
        // Filter out old demographic data
        const nonDemographicParts = existingParts.filter((part: string) => {
          const key = part.split(':')[0].trim();
          return !demographicKeys.includes(key);
        });
        
        // Combine non-demographic with new demographic data
        finalOnboardData = [...nonDemographicParts, ...onboardData.split(' | ').filter(Boolean)].join(' | ');
      }

      const { error } = await supabase
        .from('users')
        .update({ onboard: finalOnboardData })
        .eq('uuid', user.id);

      if (error) {
        console.error('Error saving demographics:', error);
        Alert.alert('Error', 'Failed to save changes. Please try again.');
      } else {
        Alert.alert('Success', 'Demographics updated successfully');
      }
    } catch (error) {
      console.error('Exception saving demographics:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Demographics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Black cover above header */}
      <View style={styles.headerCover} />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demographics</Text>
      </View>

      {/* Scrollable Content */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title & Subtitle */}
          <Text style={styles.title1}>Demographic Indicators</Text>
          <Text style={styles.subtitleText}>
            We use this information to tell you exactly how certain policies and political actions impact you specifically. You can fill out as little or as much as you want, or skip it entirely.
          </Text>

          {/* State Code Input */}
          <View style={styles.stateCodeWrapper}>
            <View style={styles.stateCodeContainer}>
              <Text style={styles.stateCodeLabel}>State Code</Text>
              <TextInput
                style={styles.stateCodeInput}
                placeholder="Ex: WA"
                placeholderTextColor="#666"
                value={stateCode}
                onChangeText={(text) => {
                  // Only allow letters, max 2 characters, auto-capitalize
                  const filtered = text.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
                  setStateCode(filtered);
                }}
                maxLength={2}
                autoCapitalize="characters"
                keyboardType="default"
                blurOnSubmit={true}
              />
            </View>
            {stateCode.length === 2 && !isValidStateCode(stateCode) && (
              <Text style={styles.stateCodeError}>Invalid state code</Text>
            )}
          </View>

          {/* Age & Gender Label */}
          <Text style={styles.educationLabel}>Age & Gender</Text>

          {/* Age & Gender Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {/* Age Options */}
            {['Below 24', '25-35', '36-48', '49+'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={age === option}
                onPress={(word) => {
                  setAge(age === word ? '' : word);
                }}
              />
            ))}
            {/* Gender Options */}
            {['Male', 'Female', 'Other'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={gender === option}
                onPress={(word) => {
                  setGender(gender === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Political Standing Label */}
          <Text style={styles.educationLabel}>Political Standing</Text>

          {/* Political Standing Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Democrat', 'Republican', 'Centrist', 'Left Leaning', 'Right Leaning', 'Other'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={politicalStanding === option}
                onPress={(word) => {
                  setPoliticalStanding(politicalStanding === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Education Level Label */}
          <Text style={styles.educationLabel}>Highest Education Level</Text>

          {/* Education Level Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['None', 'High School', 'College/University In Progress', 'Bachelors/Associates', 'Masters/PHD'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={educationLevel === option}
                onPress={(word) => {
                  setEducationLevel(educationLevel === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Employment Status Label */}
          <Text style={styles.educationLabel}>Employment Status</Text>

          {/* Employment Status Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Employed full-time', 'Part-time', 'Gig / Freelance work', 'Student', 'Unemployed', 'Retired'].map((option) => {
              const isSelected = employmentStatus.includes(option);
              return (
                <SearchFilterButton
                  key={option}
                  word={option}
                  isSelected={isSelected}
                  onPress={(word) => {
                    if (isSelected) {
                      setEmploymentStatus(employmentStatus.filter(item => item !== word));
                    } else {
                      setEmploymentStatus([...employmentStatus, word]);
                    }
                  }}
                />
              );
            })}
          </View>

          {/* Income Level Label */}
          <Text style={styles.educationLabel}>Income Level</Text>

          {/* Income Level Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Under $25,000', '$25,000 – $49,999', '$50,000 – $99,999', '$100k – $199,999', '$200k or more'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={incomeLevel === option}
                onPress={(word) => {
                  setIncomeLevel(incomeLevel === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Race & Ethnicity Label */}
          <Text style={styles.educationLabel}>Race & Ethnicity</Text>

          {/* Race & Ethnicity Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Black or African American', 'White', 'Hispanic or Latino', 'Asian', 'Middle Eastern or North African', 'Native American or Alaska Native', 'Islander', 'Multiracial'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={raceEthnicity === option}
                onPress={(word) => {
                  setRaceEthnicity(raceEthnicity === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Dependent Status Label */}
          <Text style={styles.educationLabel}>Dependent Status</Text>

          {/* Dependent Status Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Children', 'Elderly family member', 'Disabled Dependent', 'No Dependents'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={dependentStatus === option}
                onPress={(word) => {
                  setDependentStatus(dependentStatus === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Military Status Label */}
          <Text style={styles.educationLabel}>Military Status</Text>

          {/* Military Status Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['No military affiliation', 'Active duty', 'National Guard or Reserve', 'Veteran', 'Military Dependent'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={militaryStatus === option}
                onPress={(word) => {
                  setMilitaryStatus(militaryStatus === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Immigration Status Label */}
          <Text style={styles.educationLabel}>Immigration Status</Text>

          {/* Immigration Status Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['U.S. Citizen', 'Green Card', 'Visa Holder', 'Non-Citizen Status'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={immigrationStatus === option}
                onPress={(word) => {
                  setImmigrationStatus(immigrationStatus === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Government Benefits Label */}
          <Text style={styles.educationLabel}>Government Benefits</Text>

          {/* Government Benefits Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['None', 'SNAP / Food Assistance', 'Medicaid or Medicare', 'SSI / SSDI', 'Housing', 'Unemployment', 'Education', 'Other Assistance'].map((option) => {
              const isSelected = governmentBenefits.includes(option);
              return (
                <SearchFilterButton
                  key={option}
                  word={option}
                  isSelected={isSelected}
                  onPress={(word) => {
                    if (isSelected) {
                      setGovernmentBenefits(governmentBenefits.filter(item => item !== word));
                    } else {
                      setGovernmentBenefits([...governmentBenefits, word]);
                    }
                  }}
                />
              );
            })}
          </View>

          {/* Sexual Orientation Label */}
          <Text style={styles.educationLabel}>Sexual Orientation</Text>

          {/* Sexual Orientation Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Heterosexual', 'Homosexual', 'Bisexual', 'Asexual', 'Other'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={sexualOrientation === option}
                onPress={(word) => {
                  setSexualOrientation(sexualOrientation === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Voter Eligibility Label */}
          <Text style={styles.educationLabel}>Voter Eligibility</Text>

          {/* Voter Eligibility Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Registered and Eligible', 'Eligible, Not Registered', 'Not Eligible'].map((option) => (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={voterEligibility === option}
                onPress={(word) => {
                  setVoterEligibility(voterEligibility === word ? '' : word);
                }}
              />
            ))}
          </View>

          {/* Disability Status Label */}
          <Text style={styles.educationLabel}>Disability Status</Text>

          {/* Disability Status Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['None', 'Physical Disability', 'Cognitive or Learning Disability', 'Mental Health Condition', 'Multiple Disabilities'].map((option) => {
              const isSelected = disabilityStatus.includes(option);
              return (
                <SearchFilterButton
                  key={option}
                  word={option}
                  isSelected={isSelected}
                  onPress={(word) => {
                    if (isSelected) {
                      setDisabilityStatus(disabilityStatus.filter(item => item !== word));
                    } else {
                      setDisabilityStatus([...disabilityStatus, word]);
                    }
                  }}
                />
              );
            })}
          </View>

          {/* Industry of Work or Study Label */}
          <Text style={styles.educationLabel}>Industry of Work or Study</Text>

          {/* Industry of Work or Study Filter Buttons */}
          <View style={styles.educationButtonsContainer}>
            {['Healthcare', 'Technology', 'Education', 'Finance / Business', 'Government', 'Public Sector', 'Military / Defense', 'Manufacturing', 'Trades', 'Politics', 'Service / Hospitality', 'Retail', 'Transportation', 'Logistics', 'Creative', 'Agriculture / Environment', 'Other'].map((option) => {
              const isSelected = industryOfWork.includes(option);
              return (
                <SearchFilterButton
                  key={option}
                  word={option}
                  isSelected={isSelected}
                  onPress={(word) => {
                    if (isSelected) {
                      setIndustryOfWork(industryOfWork.filter(item => item !== word));
                    } else {
                      setIndustryOfWork([...industryOfWork, word]);
                    }
                  }}
                />
              );
            })}
          </View>

          {/* Additional Information Label */}
          <Text style={styles.educationLabel}>Additional Information</Text>

          {/* Additional Information Text Input */}
          <TextInput
            style={styles.additionalInfoInput}
            placeholder="This helps improve how accurate we are in determining how political events personally impact you."
            placeholderTextColor="#666"
            value={additionalInformation}
            onChangeText={setAdditionalInformation}
            multiline={true}
            textAlignVertical="top"
            blurOnSubmit={true}
          />
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Black background below save button */}
      <View style={styles.saveButtonBackground} />

      {/* SAVE BUTTON */}
      <Pressable
        disabled={saving}
        onPressIn={() => !saving && Haptics.selectionAsync()}
        style={[
          styles.saveButton,
          saving && styles.saveButtonDisabled
        ]}
        onPress={handleSave}
      >
        <Text style={[
          styles.saveButtonText,
          saving && styles.saveButtonTextDisabled
        ]}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // HEADER
  headerContainer: {
    position: 'absolute',
    top: 30,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  title1: {
    alignSelf: 'flex-start',
    textAlign: 'left',
    color: '#fff',
    fontSize: 23,
    fontWeight: 'medium',
    marginBottom: '2%',
    paddingLeft: '5%',
    marginTop: 20,
  },
  subtitleText: {
    alignSelf: 'flex-start',
    textAlign: 'left',
    color: '#888',
    fontSize: 16,
    marginBottom: '3%',
    paddingLeft: '5%',
    paddingRight: '5%',
  },
  stateCodeWrapper: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: '2%',
  },
  stateCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateCodeLabel: {
    color: '#fff',
    fontSize: 18,
    marginRight: 10,
    minWidth: 100,
  },
  stateCodeInput: {
    width: 100,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 0,
    color: '#fff',
    height: 50,
    fontSize: 18,
    textAlign: 'center',
  },
  stateCodeError: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 0,
  },
  educationLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 10,
    paddingLeft: '5%',
  },
  educationButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '90%',
    alignSelf: 'center',
    marginBottom: 10,
  },
  additionalInfoInput: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 240,
    marginTop: 10,
    marginBottom: 350,
  },
  headerCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#000',
    zIndex: 99,
  },
  saveButtonBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#000',
    zIndex: 98,
  },
  saveButton: {
    position: 'absolute',
    bottom: 30,
    left: '5%',
    right: '5%',
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#101010',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    zIndex: 99,
  },
  saveButtonDisabled: {
    backgroundColor: '#080808',
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  saveButtonTextDisabled: {
    color: '#888',
  },
});


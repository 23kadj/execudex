// AsyncStorage is lazy-loaded to prevent crashes in preview/release builds
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router'; // <-- Add this if using expo-router
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../../components/AuthProvider';
import { ProfileLoadingIndicator } from '../../components/ProfileLoadingIndicator';
import { NavigationService } from '../../services/navigationService';
import { getSupabaseClient } from '../../utils/supabase';
// If using React Navigation, use: import { useNavigation } from '@react-navigation/native';

// Import Supabase client

// ── Tweakable constants ───────────────────────────
const SLIDER_TOP_MARGIN = -14;
const TEXT_COLOR        = '#fff';
const INVERT_SWIPE      = true;
const SLIDER_WIDTH      = '40%';
const LABEL_SPACING     = 1;
const BUTTON_COLOR      = '#101010';
// ─────────────────────────────────────────────────

// IMAGE ASSETS
const images = {
  img1:    require('../../assets/img1.png'),
  img2:    require('../../assets/img2.png'),
  img3:    require('../../assets/img3.png'),
  img4:    require('../../assets/img4.png'),
  img5:    require('../../assets/img5.png'),
  img6:    require('../../assets/img6.png'),
  img7:    require('../../assets/img7.png'),
  img8:    require('../../assets/img8.png'),
  img9:    require('../../assets/img9.png'),
  img10:   require('../../assets/img10.png'),
  img11:   require('../../assets/img11.png'),
  img12:   require('../../assets/img12.png'),
  greenUp: require('../../assets/greenUp.png'),
  redDown: require('../../assets/redDown.png'),
};

const HEADER_ICONS = {
  ppl: {
    active:   require('../../assets/ppl1.png'),   // white
    inactive: require('../../assets/ppl2.png'),   // black
  },
  legi: {
    active:   require('../../assets/legi1.png'),  // white
    inactive: require('../../assets/legi2.png'),  // black
  }
};


// ----------- BUTTON DATA PER SCREEN -----------

// Trending (left) - PPL MODE - Will be populated dynamically from Supabase
const BUTTONS_LEFT_PPL = [
  {
    img: images.img1,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { red: '53.6%', green: '46.4%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'national',
    index: 1,
  },
  {
    img: images.img2,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '60.8%', red: '39.2%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'national',
    index: 2,
  },
  {
    img: images.img3,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { red: '59.1%', green: '49.8%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'national',
    index: 3,
  },
  {
    img: images.img4,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '61.1%', red: '38.9%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 4,
  },
  {
    img: images.img5,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '78.2%', red: '21.8%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'city',
    index: 5,
  },
  {
    img: images.img11,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '50.0%', red: '50.0%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 150,
  },
  {
    img: null,
    name: '',
    sub_name: '',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
  },
];

// Top Rated (right) - PPL MODE - Will be populated dynamically from Supabase
const BUTTONS_RIGHT_PPL = [
  {
    img: images.img6,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { red: '24.9%', green: '75.1%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 6,
  },
  {
    img: images.img7,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '60.6%', red: '39.2%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 7,
  },
  {
    img: images.img8,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { red: '59.1%', green: '40.9%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 8,
  },
  {
    img: images.img9,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '61.1%', red: '38.9%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 9,
  },
  {
    img: images.img10,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '78.2%', red: '21.8%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 10,
  },
  {
    img: images.img12,
    name: 'Loading...',
    sub_name: 'Loading...',
    numbers: { green: '50.0%', red: '50.0%' },
    greenUp: images.greenUp,
    redDown: images.redDown,
    level: 'state',
    index: 129,
  },
  {
    img: null,
    name: '',
    sub_name: '',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
  },
];

// Trending (left) - LEGI MODE (6 buttons) - Will be populated dynamically from Supabase
const BUTTONS_LEFT_LEGI = [
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 1,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 2,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 3,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 4,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 5,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 6,
  },
  {
    img: null,
    title: '',
    subtitle: '',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
  },
];

// Top Rated (right) - LEGI MODE (6 buttons) - Will be populated dynamically from Supabase
const BUTTONS_RIGHT_LEGI = [
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 7,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 8,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 9,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 10,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 11,
  },
  {
    img: null,
    title: 'Loading...',
    subtitle: 'Loading...',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
    index: 12,
  },
  {
    img: null,
    title: '',
    subtitle: '',
    numbers: { red: '', green: '' },
    greenUp: null,
    redDown: null,
    level: undefined,
  },
];

// ----------- GENERIC BUTTON RENDERER -----------
type ButtonNumbers = { red: string; green: string };
type ButtonData = {
  img: any;
  name?: string;
  sub_name?: string;
  title?: string;
  subtitle?: string;
  numbers: ButtonNumbers;
  greenUp: any;
  redDown: any;
  level?: string;
  index?: number;
};
type StyleObj = { [key: string]: any };
function ButtonGeneric({ img, name, sub_name, title, subtitle, numbers, greenUp, redDown, styleObj }: ButtonData & { styleObj: StyleObj }) {
  // Check if this is an empty button (no name)
  const displayName = name || title || '';
  const displaySubtitle = sub_name || subtitle || '';
  
  if (displayName === '') {
    return (
      <View style={styles.emptyButtonContainer}>
        <Image source={require('../../assets/more.png')} style={styles.moreIcon} />
      </View>
    );
  }
  
  // Check if this is a LEGI mode button (no image, different layout)
  if (img === null) {
    return (
      <View style={styles.legiContainer}>
        <View style={styles.legiTopRow}>
          <Text style={styleObj.legiTitle || styles.legiTitle}>{displayName}</Text>
          {greenUp && redDown && (
            <View style={styles.legiNumbers}>
              <Image source={greenUp} style={styles.legiArrowIconGreen} />
              <Text style={styleObj.legiGreenNum || styles.legiGreenNum}>{numbers.green}</Text>
              <Image source={redDown} style={styles.legiArrowIconRed} />
              <Text style={styleObj.legiRedNum || styles.legiRedNum}>{numbers.red}</Text>
            </View>
          )}
        </View>
        <View style={styles.legiBottomRow}>
          <Text style={styleObj.legiDate || styles.legiDate}>{displaySubtitle}</Text>
        </View>
      </View>
    );
  }

  // Original PPL mode layout
  return (
    <View style={styleObj.row}>
      <Image source={img} style={styleObj.profile} />
      <View style={styleObj.textCol}>
        <Text style={styleObj.title}>{displayName}</Text>
        <Text style={styleObj.subtitle}>{displaySubtitle}</Text>
        <View style={styleObj.numbers}>
          <Image source={redDown} style={styleObj.arrow} />
          <Text style={styleObj.redNum}>{numbers.red}</Text>
          <Image source={greenUp} style={styleObj.arrow} />
          <Text style={styleObj.greenNum}>{numbers.green}</Text>
        </View>
      </View>
    </View>
  );
}

// ----------- STYLES -----------
const styles = StyleSheet.create({
  iconWrapActive: {
    position:      'absolute',
    width:         40,
    height:        40,
    borderRadius:  100,
    backgroundColor:'#fff',
    justifyContent: 'center',
    alignItems:     'center',
    zIndex: 1,
    // shadow/elevation as before
    shadowColor:   '#000',
    shadowOpacity: 0.18,
    shadowRadius:  6,
    shadowOffset:  { width: 0, height: 1 },
    elevation:     5,
  },


  container: {
    flex:            1,
    backgroundColor: '#000',
  },
  statusBarCover: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
    backgroundColor: '#000',
    zIndex:          1000,
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingTop:        Platform.OS === 'ios' ? 30 : (StatusBar.currentHeight || 0) + 0,
    paddingHorizontal: 30,
  },
  logo:        { width: 160, height: 80, resizeMode: 'contain' },
  headerRight: { flexDirection: 'row' },
  icon: {
    width:        24,
    height:       24,
    resizeMode:  'contain',
    zIndex: 2,
    // Remove marginLeft!
  },


  sliderContainer: {
    width:     SLIDER_WIDTH,
    alignSelf: 'center',
    height:    25,
  },
  labels: {
    flexDirection:  'row',
    alignItems:     'center',
  },
  labelBox: {
    justifyContent: 'center',
    alignItems:     'center',
    height:         '100%',
  },
  labelText: {
    fontSize:   13,
    fontWeight: '400',
  },

  indicator: {
    position:        'absolute',
    bottom:          0,
    height:          2,
    borderRadius:    20,
    backgroundColor: '#fff',
  },

  card: {
    width:           '96%',
    backgroundColor: '#050505',
    borderRadius:    30,
    alignSelf:       'center',
    top:             0,
    marginBottom:    5,
    overflow:        'hidden',
  },
  // Grid container shown behind politician buttons only
  pplGrid: {
    width:           '98%',
    backgroundColor: '#050505',
    borderRadius:    30,
    alignSelf:       'center',
    marginTop:       -5,
    marginBottom:    5,
    overflow:        'hidden',
    borderWidth:     1,
    paddingVertical: 5,
  },

  buttonList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },

  button: {
    width:           '93%',
    height:          92,
    backgroundColor: '#080808', // keep current color
    borderRadius:    22,
    marginVertical:  5,         // keep current spacing
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },

  // First button style (match base politician buttons)
  buttonFirst: {
    width:           '93%',
    height:          92,
    backgroundColor: '#080808', // keep current color
    borderRadius:    22,
    marginVertical:  5,         // keep current spacing
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },

  // LEGI mode button (shorter height for 6 buttons)
  buttonLegi: {
    width:           '95%',
    height:          75,
    backgroundColor: '#040404',
    borderRadius:    22,
    marginVertical:  5,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     '#101010',
  },
  
  // Empty button style (customizable size)
  buttonEmpty: {
    width:           '92%',
    height:          50,        // ← **CHANGE THIS** to modify only empty button height
    backgroundColor: '#090909',
    borderRadius:    18,
    marginVertical:  7,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  emptyButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
    tintColor: '#fff',
  },

  // LEGI mode content layout
  legiContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  legiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  legiBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  legiTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
  },
  legiDate: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
  },
  legiNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legiArrowIcon: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
    marginHorizontal: 3,
  },
  // New separate arrow styles for LEGI mode
  legiArrowIconGreen: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
    marginHorizontal: 3,
  },
  legiArrowIconRed: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
    marginHorizontal: 3,
  },
  legiGreenNum: {
    color: '#008610',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 2,
    marginRight: 5,
  },
  legiRedNum: {
    color: '#8F0000',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 2,
  },
  legiRectangle: {
    width: '90%',
    height: '25%',
    backgroundColor: '#0A0A0A',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },



  // ---- BUTTON LEFT (1) styles ----
  buttonContentRow1: {
    flexDirection: 'row',
    alignItems:    'center',
    flex: 1,
    width: '100%',
    paddingHorizontal: 14,
  },
  profileImg1: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    borderRadius: 14,
    left: -14,
    bottom: -2,
  },

    profileImg10: {
    width: 190,
    height: 190,
    resizeMode: 'contain',
    borderRadius: 14,
    left: -20,
    bottom: -2,
  },

    profileImg8: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    borderRadius: 14,
    left: -14,
    bottom: -2,
  },

  profileImg5: {
    width: 160,
    height: 160,
    resizeMode: 'contain',
    borderRadius: 14,
    left: -14,
    bottom: -2,
  },

  textsCol1: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    right: 10,
  },

  textsCol10: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    right: 10,
    width: '100%'
  },
  textsCol8: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    right: 3,
  },

  textsCol6: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    right: 5,
  },


  textsCol5: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    left: 0,
    width: 1000
  },



  titleText1: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 21,
    lineHeight: 27,
    left: 8
  },

  
  titleText8: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 21,
    lineHeight: 27,
    left: 14
  },

  titleText6: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 21,
    lineHeight: 27,
    left: 28
  },

  titleText3: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 23,
    lineHeight: 27,
    left: 30
  },

    titleText4: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 21,
    lineHeight: 27,
    right: 30
  },

    titleText9: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 23,
    lineHeight: 27,
    right: 26
  },

  titleText11: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 23,
    lineHeight: 27,
    right: 35
  },

  titleText12: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 23,
    lineHeight: 27,
    right: 15
  },

  titleText5: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 21,
    lineHeight: 27,
  top: 1,
  right: 20,
  width: '150%'
  },

    titleText10: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 21,
    lineHeight: 27,
  top: 1,
  right: 20,
  width: '500%'
  },

  subtitleText1: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    left: -6
  },
  
  subtitleText8: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    left: 7
  },


  subtitleText3: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    left: 18,
    width: '150%',
  },

    subtitleText4: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    left: 30,
    width: '100%',
  },


  subtitleText5: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    right: 0,
    width: '200%'
  },

  subtitleText10: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    right: 28,
    width: '200%'
  },



  numbersRow1: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       5,
    right: -7
  },


    numbersRow6: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       5,
    right: -7
  },

    numbersRow3: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       4,
    left: 10,
  },

    numbersRow4: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       4,
    right: 27,
  },

      numbersRow9: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       4,
    right: 10,
  },

  numbersRow11: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       4,
    right: 23,
  },

  numbersRow12: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       4,
    right: 35,
  },


  numbersRow5: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       3,
    right: 5
  },

    numbersRow10: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       3,
    right: 22
  },

  arrowIcon1: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
    marginHorizontal: 3,
  },
  redNum1: {
    color: '#8F0000',
    fontWeight: '600',
    fontSize: 13,
    marginRight: 8,
    marginLeft: 1,
  },
  greenNum1: {
    color: '#008610',
    fontWeight: '600',
    fontSize: 13,
    marginRight: 6,
  },

  // ---- BUTTON RIGHT (2) styles ----
  buttonContentRow2: {
    flexDirection: 'row-reverse', // right style: image on right
    alignItems:    'center',
    flex: 1,
    width: '100%',
    paddingHorizontal: 14,
    justifyContent: 'flex-end',
  },
  profileImg2: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    borderRadius: 14,
    marginRight: 0,
    right: 15
  },
  profileImg11: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    borderRadius: 14,
    marginRight: 0,
    right: 15
  },
  profileImg12: {
    width: 105,
    height: 105,
    resizeMode: 'contain',
    borderRadius: 14,
    marginRight: 0,
    right: 15
  },
    profileImg3: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    borderRadius: 14,
    marginRight: 0,
    right: 15
  },
  textsCol2: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    left: -16
  },

    textsCol7: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    right: 13
  },

  textsCol3: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    right: -5,
  },

  titleText2: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 22,
    lineHeight: 27,
    right: 8
  },


  subtitleText2: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    right: 10,
  },

  subtitleText11: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14.5,
    lineHeight: 18,
    marginTop: 2,
    right: 35,
  },

  subtitleText12: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    right: 37,
  },


    subtitleText7: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    right: 19,
  },

  subtitleText6: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    right: -2,
  },

  numbersRow2: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       5,
    justifyContent: 'flex-end',
    right: 15,
  },

  numbersRow7: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       5,
    justifyContent: 'flex-end',
    right: 10,
  },

  arrowIcon2: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
    marginHorizontal: 3,
  },
  redNum2: {
    color: '#8F0000',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 8,
    marginRight: 1,
    right: 6
  },
  greenNum2: {
    color: '#008610',
    fontWeight: '600',
    fontSize: 13,
    marginRight: 6,
  },
  profileRequestContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  profileRequestText: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: '400',
    textAlign: 'center',
  },
  profileRequestInputContainer: {
    width: '90%',
    alignSelf: 'center',
    height: 60,
    marginTop: 3,
    marginBottom: 10,
  },
  profileRequestInput: {
    flex: 1,
    backgroundColor: '#050505',
    borderRadius: 20,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    textAlign: 'left',
  },
  filterButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 8,
    paddingHorizontal: 0,
    width: '92%',
    alignSelf: 'center',
  },
  politicalPositionButton: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 54,
    width: '98%',
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  politicalPositionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 54,
    width: '98%',
    marginLeft: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  submitButtonContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    height: 55,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Politician Position Grid Styles
  politicianPositionButtonSelected: {
    backgroundColor: '#fff',
  },
  politicianPositionButtonTextSelected: {
    color: '#000',
  },
  otherOfficialsContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: 15,
  },
  otherOfficialsButton: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherOfficialsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  otherOfficialsButtonTextSelected: {
    color: '#000',
  },
  searchResultContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#050505',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchResultText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  newPoliticianButtonContainer: {
    width: '95%',
    alignSelf: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  newPoliticianButton: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#101010',
  },
  newPoliticianButtonContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  newPoliticianTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  newPoliticianBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  newPoliticianTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  newPoliticianSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
  newPoliticianTypeBadge: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 24,
  },
  newPoliticianTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
  // New legislation button styles (matching exp1 format)
  newLegislationButtonContainer: {
    width: '95%',
    alignSelf: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  newLegislationButton: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#101010',
  },
  newLegislationButtonContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  newLegislationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  newLegislationBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  newLegislationTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  newLegislationSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
  newLegislationTypeBadge: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 24,
  },
  newLegislationTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
});
function getImgKey(img: any) {
  // Returns the key for each image
  switch(img) {
    case images.img1:  return 'img1';
    case images.img2:  return 'img2';
    case images.img3:  return 'img3';
    case images.img4:  return 'img4';
    case images.img5:  return 'img5';
    case images.img6:  return 'img6';
    case images.img7:  return 'img7';
    case images.img8:  return 'img8';
    case images.img9:  return 'img9';
    case images.img10: return 'img10';
    case images.img11: return 'img11';
    case images.img12: return 'img12';
    default:           return 'placeholder';
  }
}
// ---- STYLE ARRAYS ----

// Trending: buttons 2 and 4 = right style
const buttonStylesTrending = [
  // 1. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg1,
    textCol:  styles.textsCol1,
    title:    styles.titleText1,
    subtitle: styles.subtitleText1,
    numbers:  styles.numbersRow1,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 2. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText2,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow2,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 3. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg3,
    textCol:  styles.textsCol3,
    title:    styles.titleText3,
    subtitle: styles.subtitleText3,
    numbers:  styles.numbersRow3,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 4. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg11,
    textCol:  styles.textsCol2,
    title:    styles.titleText4,
    subtitle: styles.subtitleText4,
    numbers:  styles.numbersRow4,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 5. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg5,
    textCol:  styles.textsCol5,
    title:    styles.titleText5,
    subtitle: styles.subtitleText5,
    numbers:  styles.numbersRow5,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 6. right (clone of button 9)
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg11,
    textCol:  styles.textsCol2,
    title:    styles.titleText11,
    subtitle: styles.subtitleText11,
    numbers:  styles.numbersRow11,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 7. right (empty button)
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText2,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow2,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
];

// Top Rated: buttons 2 and 4 = right style
const buttonStylesTopRated = [
  // 1. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg1,
    textCol:  styles.textsCol6,
    title:    styles.titleText6,
    subtitle: styles.subtitleText6,
    numbers:  styles.numbersRow6,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 2. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol7,
    title:    styles.titleText2,
    subtitle: styles.subtitleText7,
    numbers:  styles.numbersRow7,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 3. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg8,
    textCol:  styles.textsCol8,
    title:    styles.titleText8,
    subtitle: styles.subtitleText8,
    numbers:  styles.numbersRow1,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 4. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText9,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow9,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 5. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg10,
    textCol:  styles.textsCol10,
    title:    styles.titleText10,
    subtitle: styles.subtitleText10,
    numbers:  styles.numbersRow10,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 6. right (clone of button 9)
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg12,
    textCol:  styles.textsCol2,
    title:    styles.titleText12,
    subtitle: styles.subtitleText12,
    numbers:  styles.numbersRow12,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 7. right (empty button)
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText2,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow2,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
];

// LEGI MODE - Trending: 6 buttons alternating left/right style
const buttonStylesTrendingLegi = [
  // 1. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg1,
    textCol:  styles.textsCol1,
    title:    styles.titleText1,
    subtitle: styles.subtitleText1,
    numbers:  styles.numbersRow1,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 2. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText2,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow2,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 3. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg3,
    textCol:  styles.textsCol3,
    title:    styles.titleText3,
    subtitle: styles.subtitleText3,
    numbers:  styles.numbersRow3,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 4. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText4,
    subtitle: styles.subtitleText4,
    numbers:  styles.numbersRow4,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 5. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg5,
    textCol:  styles.textsCol5,
    title:    styles.titleText5,
    subtitle: styles.subtitleText5,
    numbers:  styles.numbersRow5,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 6. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText2,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow2,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 7. left (empty button)
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg1,
    textCol:  styles.textsCol1,
    title:    styles.titleText1,
    subtitle: styles.subtitleText1,
    numbers:  styles.numbersRow1,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
];

// LEGI MODE - Top Rated: 6 buttons alternating left/right style
const buttonStylesTopRatedLegi = [
  // 1. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg1,
    textCol:  styles.textsCol6,
    title:    styles.titleText6,
    subtitle: styles.subtitleText6,
    numbers:  styles.numbersRow6,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 2. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol7,
    title:    styles.titleText2,
    subtitle: styles.subtitleText7,
    numbers:  styles.numbersRow7,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 3. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg8,
    textCol:  styles.textsCol8,
    title:    styles.titleText8,
    subtitle: styles.subtitleText8,
    numbers:  styles.numbersRow1,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 4. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol2,
    title:    styles.titleText9,
    subtitle: styles.subtitleText2,
    numbers:  styles.numbersRow9,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 5. left
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg10,
    textCol:  styles.textsCol10,
    title:    styles.titleText10,
    subtitle: styles.subtitleText10,
    numbers:  styles.numbersRow10,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
  // 6. right
  {
    row:      styles.buttonContentRow2,
    profile:  styles.profileImg2,
    textCol:  styles.textsCol7,
    title:    styles.titleText2,
    subtitle: styles.subtitleText7,
    numbers:  styles.numbersRow7,
    arrow:    styles.arrowIcon2,
    redNum:   styles.redNum2,
    greenNum: styles.greenNum2,
  },
  // 7. left (empty button)
  {
    row:      styles.buttonContentRow1,
    profile:  styles.profileImg1,
    textCol:  styles.textsCol6,
    title:    styles.titleText6,
    subtitle: styles.subtitleText6,
    numbers:  styles.numbersRow6,
    arrow:    styles.arrowIcon1,
    redNum:   styles.redNum1,
    greenNum: styles.greenNum1,
  },
];



// ----------- MAIN COMPONENT -----------
export default function Home() {
  const router = useRouter(); // <-- Add this if using expo-router
  const { user } = useAuth();
  // If using React Navigation: const navigation = useNavigation();
  const params = useLocalSearchParams();
  
  // Handle return state from index2
  const returnTab = typeof params.returnTab === 'string' ? parseInt(params.returnTab) : 0;
  const returnMode = typeof params.returnMode === 'string' ? params.returnMode as 'ppl' | 'legi' : 'ppl';
  
  const [selected, setSelected] = useState<0|1>(returnTab as 0|1);
  const [sliderWidth, setSliderWidth] = useState(0);
  const halfWidth = sliderWidth / 2;
  // Add scale for all buttons (PPL mode: 12 buttons total with clones)
  const buttonScales = useRef([...Array(20)].map(() => new Animated.Value(1))).current;

  const [headerTab, setHeaderTab] = useState<'ppl' | 'legi'>(returnMode);

  // State for dynamic data from Supabase
  const [trendingData, setTrendingData] = useState(BUTTONS_LEFT_PPL);
  const [topRatedData, setTopRatedData] = useState(BUTTONS_RIGHT_PPL);
  const [trendingLegiData, setTrendingLegiData] = useState(BUTTONS_LEFT_LEGI);
  const [topRatedLegiData, setTopRatedLegiData] = useState(BUTTONS_RIGHT_LEGI);

  // State for Political Position button cycling
  const [politicalPositionLabel, setPoliticalPositionLabel] = useState('Political Position');
  const [selectedPoliticianPosition, setSelectedPoliticianPosition] = useState<string | null>(null);
  const [profileRequestText, setProfileRequestText] = useState('');
  const [congressSessionText, setCongressSessionText] = useState('');
  
  // Handle congress input with automatic numeric filtering
  const handleCongressInputChange = (text: string) => {
    // Strip all non-numeric characters
    const numericOnly = text.replace(/[^0-9]/g, '');
    setCongressSessionText(numericOnly);
  };
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputYPosition = useRef(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{success: boolean, message: string} | null>(null);
  const [rawJsonOutput, setRawJsonOutput] = useState<string | null>(null);
  const [newPoliticianData, setNewPoliticianData] = useState<{id: string, name: string, sub_name: string} | null>(null);
  const [newLegislationData, setNewLegislationData] = useState<{id: string, name: string, congress: string, sub_name: string} | null>(null);
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const politicianPositions = ['President', 'Vice President', 'Senator', 'Governor', 'Representative', 'Mayor', 'Cabinet', 'Candidate'];
  
  // Handle cancel profile loading
  const handleCancelProfileLoading = () => {
    NavigationService.cancelProcessing();
  };
  
  // Animated scales for politician position buttons
  const politicianButtonScales = useRef(
    politicianPositions.map(() => new Animated.Value(1))
  ).current;

  // Set up navigation service loading callback
  useEffect(() => {
    NavigationService.setLoadingCallback(setIsProcessingProfile);
    NavigationService.setErrorCallback(setProfileError);
  }, []);

  // Show Founder's Note after onboarding (once per user)
  useEffect(() => {
    const showFoundersNote = async () => {
      if (!user?.id) return;

      try {
        // Require onboarding data to exist
        const { data: userData } = await getSupabaseClient()
          .from('users')
          .select('onboard')
          .eq('uuid', user.id)
          .maybeSingle();

        if (!userData?.onboard) return;

        const seenKey = `hasSeenFoundersNote:${user.id}`;
        // Lazy-load AsyncStorage
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        const hasSeenNote = await AsyncStorage.getItem(seenKey);
        if (hasSeenNote) return;

        Alert.alert(
          "Founder's Note",
          'Thank you for downloading Execudex. As we\'re in our earliest stages, we would appreciate as much feedback as possible to help us better understand our users.\n\nPlease be patient with load times as we\'re still building our database; while some profiles load instantly, some will not. Enjoy the app :)',
          [
            {
              text: 'OK',
              onPress: async () => {
                await AsyncStorage.setItem(seenKey, 'true');
              }
            }
          ],
          { cancelable: false }
        );
      } catch (error) {
        console.error('Error showing Founder\'s Note:', error);
      }
    };

    showFoundersNote();
  }, [user?.id]);
  const otherOfficialsScale = useRef(new Animated.Value(1)).current;
  const newPoliticianButtonScale = useRef(new Animated.Value(1)).current;
  const newLegislationButtonScale = useRef(new Animated.Value(1)).current;
  const politicalPositionLabels = ['Political Position', 'President', 'Vice President', 'Cabinet', 'Senator', 'Representative', 'Governor', 'Mayor', 'Candidate'];
  
  // Animated scale for Political Position and Reset buttons
  const politicalPositionScale = useRef(new Animated.Value(1)).current;
  const resetButtonScale = useRef(new Animated.Value(1)).current;

  // Cycling function for Political Position button
  const cyclePoliticalPosition = () => {
    const currentIndex = politicalPositionLabels.indexOf(politicalPositionLabel);
    const nextIndex = (currentIndex + 1) % politicalPositionLabels.length;
    setPoliticalPositionLabel(politicalPositionLabels[nextIndex]);
  };

  // Reset function
  const resetPoliticalPosition = () => {
    setPoliticalPositionLabel('Political Position');
  };

  const handlePoliticianPositionSelect = (position: string) => {
    setSelectedPoliticianPosition(selectedPoliticianPosition === position ? null : position);
  };

  // Map button text to enum values for ppl_search API
  const mapPositionToEnum = (position: string): string => {
    switch (position) {
      case 'Vice President':
        return 'vice_president';
      case 'Other Officials':
        return 'official';
      default:
        return position.toLowerCase().replace(' ', '_');
    }
  };

  // Search politician function
  const searchPolitician = async () => {
    if (!profileRequestText.trim()) {
      setSearchResult({ success: false, message: 'Please enter a politician name' });
      return;
    }

    if (!selectedPoliticianPosition) {
      setSearchResult({ success: false, message: 'Please select a political position' });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setRawJsonOutput(null);
    setNewPoliticianData(null);

    try {
      const officeType = mapPositionToEnum(selectedPoliticianPosition);
      
      const { data: result, error: fetchError } = await getSupabaseClient().functions.invoke('ppl_search', {
        body: {
          text_input: profileRequestText.trim(),
          office_type: officeType
        }
      });

      if (fetchError) {
        throw fetchError;
      }
      
      if (result.ok) {
        setSearchResult({ 
          success: true, 
          message: `Successfully added ${result.name} (${result.sub_name}) to the database!` 
        });
        // Store the new politician data for the profile button
        setNewPoliticianData({
          id: result.ppl_id.toString(),
          name: result.name,
          sub_name: result.sub_name
        });
        // Clear the form
        setProfileRequestText('');
        setSelectedPoliticianPosition(null);
        // Refresh the data to show the new politician
        fetchPoliticianData();
      } else {
        let errorMessage = 'Search failed';
        if (result.reason === 'duplicate') {
          errorMessage = 'This politician already exists in the database';
        } else if (result.reason === 'invalid') {
          errorMessage = 'Invalid politician or not found';
        } else if (result.error) {
          errorMessage = result.error;
        }
        setSearchResult({ success: false, message: errorMessage });
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch politician data function
  const fetchPoliticianData = async () => {
      try {
        console.log('Fetching politician data for home page...');
        
        // Fetch all data from ppl_index
        const { data: allData, error } = await getSupabaseClient()
          .from('ppl_index')
          .select('id, name, sub_name')
          .order('id', { ascending: true });
        
        if (error) {
          console.error('Error fetching politician data:', error);
          return;
        }
        
        if (allData && allData.length > 0) {
          console.log('Successfully fetched data from ppl_index:', allData);
          
          // Fetch approval/disapproval data from ppl_profiles
          const { data: profileData, error: profileError } = await getSupabaseClient()
            .from('ppl_profiles')
            .select('index_id, approval, disapproval')
            .order('index_id', { ascending: true });
          
          if (profileError) {
            console.error('Error fetching profile data:', profileError);
          } else {
            console.log('Successfully fetched profile data:', profileData);
          }
          
          // Update trending data (indices 1-5)
          const newTrendingData = [...trendingData];
          for (let i = 0; i < 5; i++) {
            const politician = allData.find(p => p.id === i + 1);
            const profile = profileData?.find(p => p.index_id === i + 1);
            if (politician) {
              newTrendingData[i] = {
                ...newTrendingData[i],
                name: politician.name || 'No Data Available',
                sub_name: politician.sub_name || 'No Data Available',
                numbers: {
                  green: profile?.approval ? `${parseFloat(profile.approval.toString()).toFixed(1)}%` : '50.0%',
                  red: profile?.disapproval ? `${parseFloat(profile.disapproval.toString()).toFixed(1)}%` : '50.0%'
                }
              };
            }
          }
          // Update first clone (button 6) - ID 150 after button 5 (index 5 in array)
          const politician150 = allData.find(p => p.id === 150);
          const profile150 = profileData?.find(p => p.index_id === 150);
          if (politician150) {
            newTrendingData[5] = {
              ...newTrendingData[5],
              name: politician150.name || 'No Data Available',
              sub_name: politician150.sub_name || 'No Data Available',
              numbers: {
                green: profile150?.approval ? `${parseFloat(profile150.approval.toString()).toFixed(1)}%` : '50.0%',
                red: profile150?.disapproval ? `${parseFloat(profile150.disapproval.toString()).toFixed(1)}%` : '50.0%'
              }
            };
          }
          setTrendingData(newTrendingData);
          
          // Update top rated data (indices 6-10)
          const newTopRatedData = [...topRatedData];
          for (let i = 0; i < 5; i++) {
            const politician = allData.find(p => p.id === i + 6);
            const profile = profileData?.find(p => p.index_id === i + 6);
            if (politician) {
              newTopRatedData[i] = {
                ...newTopRatedData[i],
                name: politician.name || 'No Data Available',
                sub_name: politician.sub_name || 'No Data Available',
                numbers: {
                  green: profile?.approval ? `${parseFloat(profile.approval.toString()).toFixed(1)}%` : '50.0%',
                  red: profile?.disapproval ? `${parseFloat(profile.disapproval.toString()).toFixed(1)}%` : '50.0%'
                }
              };
            }
          }
          // Update second clone (button 12) - ID 129 after button 10 (index 5 in array)
          const politician129 = allData.find(p => p.id === 129);
          const profile129 = profileData?.find(p => p.index_id === 129);
          if (politician129) {
            newTopRatedData[5] = {
              ...newTopRatedData[5],
              name: politician129.name || 'No Data Available',
              sub_name: politician129.sub_name || 'No Data Available',
              numbers: {
                green: profile129?.approval ? `${parseFloat(profile129.approval.toString()).toFixed(1)}%` : '50.0%',
                red: profile129?.disapproval ? `${parseFloat(profile129.disapproval.toString()).toFixed(1)}%` : '50.0%'
              }
            };
          }
          setTopRatedData(newTopRatedData);
        }
      } catch (err) {
        console.error('Error in fetchPoliticianData:', err);
      }
    };

  // Fetch legislation data function
  const fetchLegislationData = async () => {
      try {
        console.log('Fetching legislation data for home page...');
        
        // Fetch all data from legi_index
        const { data: allData, error } = await getSupabaseClient()
          .from('legi_index')
          .select('id, name, sub_name')
          .order('id', { ascending: true });
        
        if (error) {
          console.error('Error fetching legislation data:', error);
          return;
        }
        
        if (allData && allData.length > 0) {
          console.log('Successfully fetched data from legi_index:', allData);
          
          // Update trending legislation data (indices 1-6)
          const newTrendingLegiData = [...trendingLegiData];
          for (let i = 0; i < 6; i++) {
            const legislation = allData.find(l => l.id === i + 1);
            if (legislation) {
              newTrendingLegiData[i] = {
                ...newTrendingLegiData[i],
                title: legislation.name || 'No Data Available',
                subtitle: legislation.sub_name || 'No Data Available',
              };
            }
          }
          setTrendingLegiData(newTrendingLegiData);
          
          // Update top rated legislation data (indices 7-12)
          const newTopRatedLegiData = [...topRatedLegiData];
          for (let i = 0; i < 6; i++) {
            const legislation = allData.find(l => l.id === i + 7);
            if (legislation) {
              newTopRatedLegiData[i] = {
                ...newTopRatedLegiData[i],
                title: legislation.name || 'No Data Available',
                subtitle: legislation.sub_name || 'No Data Available',
              };
            }
          }
          setTopRatedLegiData(newTopRatedLegiData);
        }
      } catch (err) {
        console.error('Error in fetchLegislationData:', err);
      }
    };

  // Search bill function for legislation mode
  const searchBill = async () => {
    if (!profileRequestText.trim()) {
      setSearchResult({ success: false, message: 'Please enter a bill name' });
      return;
    }

    if (!congressSessionText.trim()) {
      setSearchResult({ success: false, message: 'Please enter a Congress session' });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setNewLegislationData(null);

    try {
      const { data: result, error: fetchError } = await getSupabaseClient().functions.invoke('bill_search', {
        body: {
          title: profileRequestText.trim(),
          congress_session: parseInt(congressSessionText.trim())
        }
      });

      if (fetchError) {
        throw fetchError;
      }
      
      if (result.ok) {
        setSearchResult({ 
          success: true, 
          message: `Successfully added ${result.name} (${result.congress} Congress) to the database!` 
        });
        // Store legislation data for the button
        setNewLegislationData({
          id: result.legi_id.toString(),
          name: result.name,
          congress: result.congress,
          sub_name: result.enrichment?.updated?.sub_name || `${result.congress}th Congress`
        });
        // Clear the form
        setProfileRequestText('');
        setCongressSessionText('');
        // Refresh the data to show the new bill
        fetchLegislationData();
      } else {
        let errorMessage = 'Search failed';
        if (result.reason === 'duplicate') {
          errorMessage = 'This bill already exists in the database';
        } else if (result.reason === 'invalid') {
          errorMessage = 'Invalid bill or not found';
        } else if (result.error) {
          errorMessage = result.error;
        }
        setSearchResult({ success: false, message: errorMessage });
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch data from ppl_index and ppl_profiles when component mounts
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardOpen(true);
      // Only auto-scroll for legislation mode
      if (headerTab === 'legi') {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardOpen(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [headerTab]);

  useEffect(() => {
    fetchPoliticianData();
    fetchLegislationData();
  }, []);

  function renderButtons(buttons: ButtonData[], stylesArr: StyleObj[], side: number) {
    return (
      <View
        style={[
          styles.buttonList,
          {
            opacity: selected === side ? 1 : 0,
            position: 'absolute',
            width: '100%',
            minHeight: 800,
          },
        ]}
        pointerEvents={selected === side ? 'auto' : 'none'}
      >
{buttons.map((btn: ButtonData, idx) => {
  // Use empty button style for buttons with no name (empty buttons)
  const displayName = btn.name || btn.title || '';
  const displaySubtitle = btn.sub_name || btn.subtitle || '';
  const buttonStyle = displayName === '' ? styles.buttonEmpty : 
                     (headerTab === 'legi' ? styles.buttonLegi : styles.button);
  const buttonIndex = side === 0 ? idx : idx + 7; // Trending: 0-6, Top Rated: 7-13
  const scale = buttonScales[buttonIndex];
  
return (
  <Animated.View
    key={`${displayName}-${idx}`}
    style={{
      transform: [{ scale }],
      width: '100%',
      alignItems: 'center',
    }}
  >
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(buttonScales[buttonIndex], {
          toValue: 0.95,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(buttonScales[buttonIndex], {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }}
      onPress={async () => {
        // Navigate to exp1 page for empty buttons (buttons with no name)
        if (displayName === '') {
          router.push('/exp1');
          return;
        }
        
        if (headerTab === 'legi') {
          await NavigationService.navigateToLegislationProfile({
            pathname: '/index2',
            params: {
              title: displayName,
              subtitle: displaySubtitle,
              imgKey: getImgKey(btn.img), // Helper function below
              numbersObj: JSON.stringify(btn.numbers),
              returnTab: selected.toString(), // 0 for Recent, 1 for Rising
              returnMode: headerTab, // 'legi' or 'ppl'
              index: btn.index?.toString(), // Pass the index for Supabase lookup
            }
          }, user?.id);
        } else {
          // Use navigation service with pre-processing for politician profiles
          await NavigationService.navigateToPoliticianProfile({
            pathname: '/index1',
            params: {
              title: displayName,
              subtitle: displaySubtitle,
              imgKey: getImgKey(btn.img), // Helper function below
              numbersObj: JSON.stringify(btn.numbers),
              index: btn.index?.toString(), // Pass the index for Supabase lookup
            }
          }, user?.id);
        }
      }}
      style={buttonStyle}
    >
      <ButtonGeneric
        img={btn.img}
        name={btn.name}
        sub_name={btn.sub_name} 
        title={btn.title}
        subtitle={btn.subtitle}
        numbers={btn.numbers}
        greenUp={btn.greenUp}
        redDown={btn.redDown}
        styleObj={stylesArr[idx]}
      />
    </Pressable>
  </Animated.View>
);

})}
      </View>
    );
  }

  function renderAllPplButtons() {
    // Combine trending and top rated buttons for PPL mode (now includes clones of button 9)
    const allButtons = [...trendingData.slice(0, 6), ...topRatedData.slice(0, 6)];
    const allStyles = [...buttonStylesTrending.slice(0, 6), ...buttonStylesTopRated.slice(0, 6)];
    
    return (
      <View style={styles.buttonList}>
        {allButtons.map((btn: ButtonData, idx) => {
          const displayName = btn.name || '';
          const displaySubtitle = btn.sub_name || '';
          // Manual label overrides for 4th and 5th PPL buttons
          const effectiveSubtitle =
            idx === 3 ? 'Governor of California' :
            idx === 4 ? 'Mayor of New York' :
            displaySubtitle;
          // Use special style for first button (idx === 0), otherwise use normal styles
          const buttonStyle = displayName === '' ? styles.buttonEmpty : 
                             (idx === 0 ? styles.buttonFirst : styles.button);
          const scale = buttonScales[idx];
          
          return (
            <Animated.View
              key={`${displayName}-${idx}`}
              style={{
                transform: [{ scale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(buttonScales[idx], {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(buttonScales[idx], {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  if (displayName === '') {
                    router.push('/exp1');
                    return;
                  }
                  
                  // Use navigation service with pre-processing for politician profiles
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: displayName,
                      subtitle: effectiveSubtitle,
                      imgKey: getImgKey(btn.img),
                      numbersObj: JSON.stringify(btn.numbers),
                      index: btn.index?.toString(),
                    }
                  }, user?.id);
                }}
                style={buttonStyle}
              >
                <ButtonGeneric
                  img={btn.img}
                  name={btn.name}
                  sub_name={effectiveSubtitle}
                  title={undefined}
                  subtitle={undefined}
                  numbers={btn.numbers}
                  greenUp={btn.greenUp}
                  redDown={btn.redDown}
                  styleObj={allStyles[idx]}
                />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  function renderAllLegiButtons() {
    // Combine recent and rising legislation for LEGI mode (all 12 buttons)
    const allButtons = [...trendingLegiData.slice(0, 6), ...topRatedLegiData.slice(0, 6)];
    const allStyles = [...buttonStylesTrendingLegi.slice(0, 6), ...buttonStylesTopRatedLegi.slice(0, 6)];
    
    return (
      <View style={styles.buttonList}>
        {allButtons.map((btn: ButtonData, idx) => {
          const displayName = btn.title || '';
          const displaySubtitle = btn.subtitle || '';
          const buttonStyle = displayName === '' ? styles.buttonEmpty : styles.buttonLegi;
          const scale = buttonScales[idx];
          
          return (
            <Animated.View
              key={`${displayName}-${idx}`}
              style={{
                transform: [{ scale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(buttonScales[idx], {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(buttonScales[idx], {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  if (displayName === '') {
                    router.push('/exp1');
                    return;
                  }
                  
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: displayName,
                      subtitle: displaySubtitle,
                      imgKey: getImgKey(btn.img),
                      numbersObj: JSON.stringify(btn.numbers),
                      returnTab: selected.toString(),
                      returnMode: headerTab,
                      index: btn.index?.toString(),
                    }
                  }, user?.id);
                }}
                style={buttonStyle}
              >
                <ButtonGeneric
                  img={btn.img}
                  name={undefined}
                  sub_name={undefined}
                  title={btn.title}
                  subtitle={btn.subtitle}
                  numbers={btn.numbers}
                  greenUp={btn.greenUp}
                  redDown={btn.redDown}
                  styleObj={allStyles[idx]}
                />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.statusBarCover} />
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <ScrollView 
            ref={scrollViewRef}
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingBottom: headerTab === 'ppl' ? 100 : 350 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            bounces={true}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {/* HEADER */}
        <View style={styles.header}>
          <Image source={require('../../assets/wordlogo1.png')} style={styles.logo} />
          <View style={styles.headerRight}>
          <Pressable
            onPress={() => {
              if (headerTab !== 'ppl') {
                setHeaderTab('ppl');
                setSearchResult(null);
                setNewLegislationData(null);
                Haptics.selectionAsync();
              }
            }}
            style={{ marginRight: 15 }}
          >
            <View style={{ width: 34, height: 34, justifyContent: 'center', alignItems: 'center' }}>
              <View
                style={[
                  styles.iconWrapActive,
                  { opacity: headerTab === 'ppl' ? 1 : 0 }
                ]}
              />
              <Image
                source={headerTab === 'ppl' ? HEADER_ICONS.ppl.active : HEADER_ICONS.ppl.inactive}
                style={styles.icon}
              />
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              if (headerTab !== 'legi') {
                setHeaderTab('legi');
                setSearchResult(null);
                setNewPoliticianData(null);
                Haptics.selectionAsync();
              }
            }}
          >
            <View style={{ width: 34, height: 34, justifyContent: 'center', alignItems: 'center' }}>
              <View
                style={[
                  styles.iconWrapActive,
                  { opacity: headerTab === 'legi' ? 1 : 0 }
                ]}
              />
              <Image
                source={headerTab === 'legi' ? HEADER_ICONS.legi.active : HEADER_ICONS.legi.inactive}
                style={styles.icon}
              />
            </View>
          </Pressable>

          </View>
        </View>

        {/* BUTTONS */}
        {headerTab === 'ppl' ? (
          <View style={styles.pplGrid}>
            {renderAllPplButtons()}
          </View>
        ) : (
          renderAllLegiButtons()
        )}

        {/* Profile Request Text */}
        <View style={styles.profileRequestContainer}>
          <Text style={styles.profileRequestText}>Profile Request</Text>
        </View>

        {/* Profile Request Input Box */}
        <View 
          style={styles.profileRequestInputContainer}
          onLayout={(event) => {
            textInputYPosition.current = event.nativeEvent.layout.y;
          }}
        >
          <TextInput
            style={styles.profileRequestInput}
            placeholder={headerTab === 'ppl' ? "Enter Politician Name" : "Enter Legislation Name"}
            placeholderTextColor="#666"
            keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
            multiline={false}
            autoCapitalize="words"
            value={String(profileRequestText ?? '')}
            onChangeText={(text) => setProfileRequestText(String(text ?? ''))}
          />
        </View>

        {/* Politician Position Grid - Only for PPL mode */}
        {headerTab === 'ppl' && (
          <>
{/* Row 1: President, Vice President */}
<View style={styles.filterButtonsRow}>
<Animated.View style={{ transform: [{ scale: politicianButtonScales[0] }], width: '50%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[0], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[0], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('President')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'President' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'President' && styles.politicianPositionButtonTextSelected
      ]}>
        President
      </Text>
    </Pressable>
  </Animated.View>

  <Animated.View style={{ transform: [{ scale: politicianButtonScales[1] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[1], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[1], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Vice President')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Vice President' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Vice President' && styles.politicianPositionButtonTextSelected
      ]}>
        Vice President
      </Text>
    </Pressable>
  </Animated.View>
</View>

{/* Row 2: Senator, Governor */}
<View style={styles.filterButtonsRow}>
  <Animated.View style={{ transform: [{ scale: politicianButtonScales[2] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[2], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[2], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Senator')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Senator' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Senator' && styles.politicianPositionButtonTextSelected
      ]}>
        Senator
      </Text>
    </Pressable>
  </Animated.View>

  <Animated.View style={{ transform: [{ scale: politicianButtonScales[3] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[3], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[3], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Governor')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Governor' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Governor' && styles.politicianPositionButtonTextSelected
      ]}>
        Governor
      </Text>
    </Pressable>
  </Animated.View>
</View>

{/* Row 3: Representative, Mayor */}
<View style={styles.filterButtonsRow}>
  <Animated.View style={{ transform: [{ scale: politicianButtonScales[4] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[4], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[4], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Representative')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Representative' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Representative' && styles.politicianPositionButtonTextSelected
      ]}>
        Representative
      </Text>
    </Pressable>
  </Animated.View>

  <Animated.View style={{ transform: [{ scale: politicianButtonScales[5] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[5], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[5], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Mayor')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Mayor' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Mayor' && styles.politicianPositionButtonTextSelected
      ]}>
        Mayor
      </Text>
    </Pressable>
  </Animated.View>
</View>

{/* Row 4: Cabinet, Candidate */}
<View style={styles.filterButtonsRow}>
  <Animated.View style={{ transform: [{ scale: politicianButtonScales[6] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[6], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[6], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Cabinet')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Cabinet' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Cabinet' && styles.politicianPositionButtonTextSelected
      ]}>
        Cabinet
      </Text>
    </Pressable>
  </Animated.View>

  <Animated.View style={{ transform: [{ scale: politicianButtonScales[7] }], width: '49%' }}>
    <Pressable
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(politicianButtonScales[7], {
          toValue: 0.95,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(politicianButtonScales[7], {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPress={() => handlePoliticianPositionSelect('Candidate')}
      style={[
        styles.politicalPositionButton,
        selectedPoliticianPosition === 'Candidate' && styles.politicianPositionButtonSelected
      ]}
    >
      <Text style={[
        styles.politicalPositionButtonText,
        selectedPoliticianPosition === 'Candidate' && styles.politicianPositionButtonTextSelected
      ]}>
        Candidate
      </Text>
    </Pressable>
  </Animated.View>
</View>

            {/* Other Officials Button */}
            <View style={styles.otherOfficialsContainer}>
              <Animated.View style={{ transform: [{ scale: otherOfficialsScale }] }}>
                <Pressable
                  onPressIn={() => {
                    Haptics.selectionAsync();
                    Animated.spring(otherOfficialsScale, {
                      toValue: 0.95,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(otherOfficialsScale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPress={() => handlePoliticianPositionSelect('Other Officials')}
                  style={[
                    styles.politicalPositionButton,
                    { width: '100%' },
                    selectedPoliticianPosition === 'Other Officials' && styles.politicianPositionButtonSelected
                  ]}
                >
                  <Text style={[
                    styles.otherOfficialsButtonText,
                    selectedPoliticianPosition === 'Other Officials' && styles.otherOfficialsButtonTextSelected
                  ]}>
                    Other Officials
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </>
        )}

        {/* Congress Session Input - Only for LEGI mode */}
        {headerTab === 'legi' && (
          <View 
            style={styles.profileRequestInputContainer}
            onLayout={(event) => {
              textInputYPosition.current = event.nativeEvent.layout.y;
            }}
          >
            <TextInput
              style={styles.profileRequestInput}
              placeholder="Enter Congress Session Number"
              placeholderTextColor="#666"
              keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
              multiline={false}
              autoCapitalize="words"
              value={String(congressSessionText ?? '')}
              onChangeText={(text) => handleCongressInputChange(String(text ?? ''))}
            />
          </View>
        )}

        {/* Submit Button */}
        <View style={styles.submitButtonContainer}>
          <TouchableOpacity
            onPress={headerTab === 'ppl' ? searchPolitician : searchBill}
            style={[styles.submitButton, isSearching && { opacity: 0.7 }]}
            activeOpacity={0.7}
            disabled={isSearching}
          >
            <Text style={styles.submitButtonText}>
              {isSearching ? 'Searching...' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Result Display */}
        {searchResult && (
          <View style={styles.searchResultContainer}>
            <Text style={[
              styles.searchResultText,
              { color: searchResult.success ? '#008610' : '#8F0000' }
            ]}>
              {searchResult.message}
            </Text>
          </View>
        )}

        {/* New Politician Profile Button */}
        {searchResult?.success && newPoliticianData && (
          <View style={styles.newPoliticianButtonContainer}>
            <Animated.View style={{ transform: [{ scale: newPoliticianButtonScale }] }}>
              <TouchableOpacity
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(newPoliticianButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    tension: 100,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(newPoliticianButtonScale, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  // Use navigation service with pre-processing for politician profiles
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: newPoliticianData.name,
                      subtitle: newPoliticianData.sub_name,
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
                      index: newPoliticianData.id,
                    }
                  }, user?.id);
                }}
                style={styles.newPoliticianButton}
                activeOpacity={0.8}
              >
                <View style={styles.newPoliticianButtonContent}>
                  <View style={styles.newPoliticianTopRow}>
                    <Text style={styles.newPoliticianTitle} numberOfLines={0} adjustsFontSizeToFit={false}>
                      {newPoliticianData.name}
                    </Text>
                    <View style={styles.newPoliticianTypeBadge}>
                      <Text style={styles.newPoliticianTypeText}>Politician</Text>
                    </View>
                  </View>
                  <View style={styles.newPoliticianBottomRow}>
                    <Text style={styles.newPoliticianSubtitle} numberOfLines={0} adjustsFontSizeToFit={false}>
                      {newPoliticianData.sub_name}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* New Legislation Profile Button */}
        {searchResult?.success && newLegislationData && (
          <View style={styles.newLegislationButtonContainer}>
            <Animated.View style={{ transform: [{ scale: newLegislationButtonScale }] }}>
              <TouchableOpacity
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(newLegislationButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    tension: 100,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(newLegislationButtonScale, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  router.push({
                    pathname: '/index2',
                    params: {
                      title: newLegislationData.name,
                      subtitle: `${newLegislationData.congress}th Congress`,
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
                      index: newLegislationData.id,
                    }
                  });
                }}
                style={styles.newLegislationButton}
                activeOpacity={0.8}
              >
                <View style={styles.newLegislationButtonContent}>
                  <View style={styles.newLegislationTopRow}>
                    <Text style={styles.newLegislationTitle} numberOfLines={0} adjustsFontSizeToFit={false}>
                      {newLegislationData.name}
                    </Text>
                    <View style={styles.newLegislationTypeBadge}>
                      <Text style={styles.newLegislationTypeText}>Legislation</Text>
                    </View>
                  </View>
                  <View style={styles.newLegislationBottomRow}>
                    <Text style={styles.newLegislationSubtitle} numberOfLines={0} adjustsFontSizeToFit={false}>
                      {newLegislationData.sub_name}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
      
      <ProfileLoadingIndicator 
        visible={isProcessingProfile} 
        error={profileError}
        onCancel={handleCancelProfileLoading}
      />
    </View>
  );
}



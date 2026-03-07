import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../styles/theme';
import { WEB_TAB_BAR_WIDTH } from '../components/WebTabBar';

const ComingSoonScreen = ({ title, icon = 'construct', onBack }) => {
  const { strings, isRTL } = useLanguage();
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity
          style={[
            styles.backButton, 
            isRTL && styles.backButtonRtl,
            isWeb && styles.backButtonWeb
          ]}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#0066CC', '#00CCFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backButtonGradient}
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color="#FFFFFF"
            />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <LinearGradient
        colors={['#0066CC', '#00CCFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Ionicons name={icon} size={48} color="#FFFFFF" />
      </LinearGradient>
      
      <Text style={[styles.title, isRTL && styles.rtlText]}>
        {title}
      </Text>
      
      <View style={styles.divider} />
      
      <Text style={[styles.message, isRTL && styles.rtlText]}>
        {strings.common?.comingSoon || 'Disponibile presto'}
      </Text>
      
      <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
        {strings.common?.comingSoonSubtitle || 'Stiamo lavorando per offrirti questa funzionalità'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 80, // Spazio per il bottone indietro
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 100,
    ...theme.shadow.card,
  },
  backButtonRtl: {
    left: 'auto',
    right: 20,
  },
  backButtonWeb: {
    left: WEB_TAB_BAR_WIDTH + 20,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginVertical: theme.spacing.md,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ComingSoonScreen;

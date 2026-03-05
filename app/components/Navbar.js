import React, { useMemo } from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { WEB_TAB_BAR_WIDTH } from './WebTabBar';
import TunisiaFlagIcon from './TunisiaFlagIcon';

const Navbar = ({ title, rightContent, onBack, backLabel, isRTL = false, isElevated = false, showFlag = false }) => {
  const { theme: appTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={[styles.safeArea, isWeb && isElevated && styles.webSafeArea]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, isRTL && styles.rtlContainer, isWeb && isElevated && styles.webContainer]}>
        <View style={[styles.leftGroup, isRTL && styles.leftGroupRtl]}>
          {onBack ? (
            <TouchableOpacity
              accessibilityLabel={backLabel || title}
              onPress={onBack}
              style={[styles.backButton, isRTL && styles.backButtonRtl]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={appTheme.colors.card} />
            </TouchableOpacity>
          ) : null}
          {showFlag && (
            <View style={styles.flagContainer}>
              <TunisiaFlagIcon size={28} />
            </View>
          )}
          <Text style={[styles.title, isRTL && styles.rtlText]}>{title}</Text>
        </View>
        {rightContent ? <View>{rightContent}</View> : null}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (appTheme) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: appTheme.colors.secondary,
      paddingTop: Platform.OS === 'android' ? appTheme.spacing.sm : 0,
    },
    webSafeArea: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
    },
    container: {
      paddingHorizontal: appTheme.spacing.lg,
      paddingVertical: appTheme.spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: appTheme.colors.secondary,
    },
    webContainer: {
      minHeight: 64,
      paddingVertical: appTheme.spacing.md,
      paddingLeft: appTheme.spacing.lg + WEB_TAB_BAR_WIDTH,
      paddingRight: appTheme.spacing.xl,
      zIndex: 20,
    },
    leftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.md,
    },
    leftGroupRtl: {
      flexDirection: 'row-reverse',
    },
    flagContainer: {
      marginRight: appTheme.spacing.xs,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: appTheme.colors.card,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonRtl: {
      borderColor: 'rgba(255,255,255,0.45)',
    },
    rtlContainer: {
      flexDirection: 'row-reverse',
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });

export default Navbar;

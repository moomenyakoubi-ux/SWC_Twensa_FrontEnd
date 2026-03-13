import React, { useMemo, useState, useCallback } from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import { WEB_TAB_BAR_WIDTH } from './WebTabBar';
import NotificationsPanel from './NotificationsPanel';

// Campanella Notifiche con badge animato
const NotificationBell = ({ count, onPress, isRTL }) => {
  const { theme: appTheme } = useAppTheme();
  
  return (
    <TouchableOpacity
      style={styles.bellButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.bellContainer}>
        <Ionicons 
          name={count > 0 ? "notifications" : "notifications-outline"} 
          size={24} 
          color={appTheme.colors.card} 
        />
        {count > 0 && (
          <View style={[
            styles.bellBadge, 
            { backgroundColor: '#ff4757' },
            isRTL ? styles.bellBadgeRTL : styles.bellBadgeLTR
          ]}>
            <Text style={styles.bellBadgeText}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const Navbar = ({ title, rightContent, onBack, backLabel, isRTL = false, isElevated = false }) => {
  const { theme: appTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const isWeb = Platform.OS === 'web';
  const { unreadCount } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleOpenNotifications = useCallback(() => {
    setIsNotificationsOpen(true);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
  }, []);

  // Default right content con campanella
  const defaultRightContent = (
    <NotificationBell 
      count={unreadCount} 
      onPress={handleOpenNotifications} 
      isRTL={isRTL} 
    />
  );

  return (
    <>
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

            <Text style={[styles.title, isRTL && styles.rtlText]}>{title}</Text>
          </View>
          {rightContent ? <View>{rightContent}</View> : defaultRightContent}
        </View>
      </SafeAreaView>

      {/* Pannello Notifiche */}
      <NotificationsPanel
        isVisible={isNotificationsOpen}
        onClose={handleCloseNotifications}
        isRTL={isRTL}
      />
    </>
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
    // Campanella styles
    bellButton: {
      padding: 8,
    },
    bellContainer: {
      position: 'relative',
    },
    bellBadge: {
      position: 'absolute',
      top: -6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: appTheme.colors.secondary,
    },
    bellBadgeLTR: {
      right: -6,
    },
    bellBadgeRTL: {
      left: -6,
    },
    bellBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
    },
  });

export default Navbar;

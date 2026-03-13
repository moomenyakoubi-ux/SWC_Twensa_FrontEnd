import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import { NotificationBell } from './NotificationsPanel';
import NotificationsPanel from './NotificationsPanel';

/**
 * HeaderActions - Componente per le azioni nell'header
 * Include la campanella notifiche con badge e il pannello notifiche
 * 
 * Uso:
 * <HeaderActions isRTL={isRTL} />
 * 
 * Oppure per solo la campanella:
 * <NotificationBell count={unreadCount} onPress={openNotifications} isRTL={isRTL} />
 */
const HeaderActions = ({ isRTL = false, showSettings = true, navigation }) => {
  const { theme: appTheme } = useAppTheme();
  const { unreadCount } = useNotifications();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleOpenPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const handleSettingsPress = useCallback(() => {
    if (navigation?.navigate) {
      navigation.navigate('AccountSettings');
    }
  }, [navigation]);

  return (
    <>
      <View style={[styles.container, isRTL && styles.containerRtl]}>
        {/* Campanella Notifiche */}
        <NotificationBell 
          count={unreadCount} 
          onPress={handleOpenPanel} 
          isRTL={isRTL} 
        />

        {/* Pulsante Impostazioni (opzionale) */}
        {showSettings && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettingsPress}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color={appTheme.colors.card} />
          </TouchableOpacity>
        )}
      </View>

      {/* Pannello Notifiche */}
      <NotificationsPanel
        isVisible={isPanelOpen}
        onClose={handleClosePanel}
        isRTL={isRTL}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  containerRtl: {
    flexDirection: 'row-reverse',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
  },
});

export default HeaderActions;

// Export individual components for flexible usage
export { NotificationBell, NotificationsPanel };

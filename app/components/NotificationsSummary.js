import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';

const NOTIFICATION_ICONS = {
  message: 'chatbubble-outline',
  like: 'heart-outline',
  comment: 'chatbubble-ellipses-outline',
  follow: 'person-add-outline',
  mention: 'at-outline',
  system: 'notifications-outline',
  default: 'notifications-outline',
};

const NOTIFICATION_COLORS = {
  message: '#0066CC',
  like: '#d64545',
  comment: '#00CCFF',
  follow: '#10b981',
  mention: '#f59e0b',
  system: '#7A869A',
  default: '#7A869A',
};

const formatTimeAgo = (dateString, strings) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return strings?.justNow || 'Adesso';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}g`;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

// Componente per notifica con animazione di entrata
const AnimatedNotificationItem = ({ notification, isRTL, strings, onPress, isNew }) => {
  const type = notification.type || 'default';
  const icon = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
  const iconColor = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.default;
  const isUnread = !notification.read;
  
  const fadeAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(isNew ? -20 : 0)).current;
  
  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isNew]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable
        style={[styles.notificationItem, isRTL && styles.notificationItemRtl]}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
      >
        <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.notificationContent}>
          <Text
            style={[
              styles.notificationText,
              isRTL && styles.rtlText,
              isUnread && styles.unreadText,
            ]}
            numberOfLines={2}
          >
            {notification.message || notification.body}
          </Text>
          <Text style={[styles.timeText, isRTL && styles.rtlText]}>
            {formatTimeAgo(notification.created_at, strings)}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </Pressable>
    </Animated.View>
  );
};

const NotificationsSummary = ({ isRTL = false, maxItems = 5 }) => {
  const navigation = useNavigation();
  const { strings } = useLanguage();
  const { 
    notifications, 
    unreadCount, 
    refreshNotifications, 
    markAsRead, 
    isInitialized 
  } = useNotifications();
  
  const [newIds, setNewIds] = useState(new Set());
  const prevNotificationsRef = useRef([]);

  // Traccia nuove notifiche per animazione
  useEffect(() => {
    const currentIds = new Set(notifications.map(n => n.id));
    const prevIds = new Set(prevNotificationsRef.current.map(n => n.id));
    const newlyAdded = new Set([...currentIds].filter(id => !prevIds.has(id)));
    
    if (newlyAdded.size > 0) {
      setNewIds(newlyAdded);
      setTimeout(() => setNewIds(new Set()), 1000);
    }
    
    prevNotificationsRef.current = notifications;
  }, [notifications]);

  // Pull to refresh manuale
  const handleRefresh = () => {
    refreshNotifications(true);
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigazione basata sul tipo
    switch (notification.type) {
      case 'message':
        if (notification.data?.conversationId) {
          navigation.navigate('Chat', { conversationId: notification.data.conversationId });
        }
        break;
      case 'like':
      case 'comment':
        if (notification.data?.likerId || notification.data?.commenterId) {
          navigation.navigate('PublicProfile', { 
            profileId: notification.data.likerId || notification.data.commenterId 
          });
        }
        break;
      case 'follow':
        if (notification.data?.followerId) {
          navigation.navigate('PublicProfile', { profileId: notification.data.followerId });
        }
        break;
      default:
        break;
    }
  };

  const handleViewAll = () => {
    // TODO: Naviga a schermata notifiche completa
    console.log('[NotificationsSummary] View all pressed');
  };

  // Limita notifiche visualizzate
  const displayedNotifications = notifications.slice(0, maxItems);

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.headerRtl]}>
        <View style={[styles.headerLeft, isRTL && styles.headerLeftRtl]}>
          <Ionicons name="notifications-outline" size={20} color={theme.colors.secondary} />
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {strings.notifications?.title || 'Notifiche'}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.headerActions, isRTL && styles.headerActionsRtl]}>
          {notifications.length > 0 && (
            <>
              <TouchableOpacity onPress={handleViewAll} style={styles.headerButton}>
                <Text style={styles.viewAllText}>
                  {strings.notifications?.viewAll || 'Vedi tutte'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
                <Ionicons name="refresh" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      {displayedNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={24} color={theme.colors.muted} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {strings?.empty || 'Nessuna notifica'}
          </Text>
        </View>
      ) : (
        <View style={styles.notificationsList}>
          {displayedNotifications.map((notification) => (
            <AnimatedNotificationItem
              key={notification.id}
              notification={notification}
              isRTL={isRTL}
              strings={strings.notifications}
              onPress={() => handleNotificationPress(notification)}
              isNew={newIds.has(notification.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  headerLeftRtl: {
    flexDirection: 'row-reverse',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerActionsRtl: {
    flexDirection: 'row-reverse',
  },
  headerButton: {
    paddingHorizontal: theme.spacing.xs,
  },
  viewAllText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 4,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  notificationsList: {
    paddingVertical: theme.spacing.xs,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  notificationItemRtl: {
    flexDirection: 'row-reverse',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 2,
  },
  notificationText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  unreadText: {
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default NotificationsSummary;

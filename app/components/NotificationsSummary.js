import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

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

const NotificationItem = ({ notification, isRTL, strings, onPress }) => {
  const type = notification.type || 'default';
  const icon = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
  const iconColor = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.default;
  const isUnread = !notification.read;

  return (
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
  );
};

const NotificationsSummary = ({ isRTL = false, maxItems = 5 }) => {
  const navigation = useNavigation();
  const { strings } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Notifications] Session:', session ? 'Present' : 'Missing');
      
      if (!session?.access_token) {
        console.log('[Notifications] No session, skipping fetch');
        setLoading(false);
        return;
      }

      const url = `${API_BASE}/api/notifications?limit=${maxItems}`;
      console.log('[Notifications] Fetching from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('[Notifications] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Notifications] Error response:', errorText);
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Notifications] Data received:', JSON.stringify(data));
      
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('[NotificationsSummary] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Refresh ogni 30 secondi
    const interval = setInterval(fetchNotifications, 30000);
    
    // Realtime subscription per nuove notifiche
    let subscription;
    
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      subscription = supabase
        .channel('notifications_' + session.user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification_logs',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            console.log('[Notifications] Realtime new notification:', payload);
            fetchNotifications(); // Ricarica tutte le notifiche
          }
        )
        .subscribe();
    };
    
    setupRealtime();
    
    return () => {
      clearInterval(interval);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const handleNotificationPress = async (notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${API_BASE}/api/notifications/${notification.id}/read`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          // Refresh lista
          fetchNotifications();
        }
      } catch (err) {
        console.error('[NotificationsSummary] Mark read error:', err);
      }
    }

    // Navigazione basata sul tipo
    switch (notification.type) {
      case 'message':
        if (notification.conversationId) {
          navigation.navigate('Chat', { conversationId: notification.conversationId });
        }
        break;
      case 'like':
      case 'comment':
      case 'follow':
        if (notification.actorId) {
          navigation.navigate('PublicProfile', { profileId: notification.actorId });
        }
        break;
      default:
        // Naviga alla schermata notifiche completa (se esiste)
        break;
    }
  };

  const handleViewAll = () => {
    // Naviga alla schermata notifiche completa
    // navigation.navigate('Notifications');
    console.log('[NotificationsSummary] View all pressed');
  };

  const handleDismiss = () => {
    setNotifications([]);
  };

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
              <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
                <Ionicons name="close" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.colors.danger} />
          <Text style={[styles.errorText, isRTL && styles.rtlText]}>
            {strings.notifications?.error || 'Errore caricamento'}
          </Text>
          <TouchableOpacity onPress={fetchNotifications}>
            <Text style={styles.retryText}>
              {strings.notifications?.retry || 'Riprova'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={24} color={theme.colors.muted} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {strings?.empty || 'Nessuna notifica'}
          </Text>
        </View>
      ) : (
        <View style={styles.notificationsList}>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              isRTL={isRTL}
              strings={strings.notifications}
              onPress={() => handleNotificationPress(notification)}
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
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  errorContainer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  retryText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
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
});

export default NotificationsSummary;

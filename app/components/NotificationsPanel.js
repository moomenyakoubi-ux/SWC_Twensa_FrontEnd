import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { useAppTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// Menu a comparsa per le opzioni
const NotificationOptionsMenu = ({ 
  visible, 
  onClose, 
  onMarkAsRead, 
  onDelete, 
  isRead,
  position,
  isRTL 
}) => {
  const { strings } = useLanguage();
  const { theme: appTheme } = useAppTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const menuItems = [
    !isRead && {
      icon: 'checkmark-circle-outline',
      label: strings.notifications?.markAsRead || 'Segna come letta',
      onPress: onMarkAsRead,
      color: appTheme.colors.primary,
    },
    {
      icon: 'trash-outline',
      label: strings.notifications?.delete || 'Elimina',
      onPress: onDelete,
      color: appTheme.colors.danger,
    },
  ].filter(Boolean);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              position: 'absolute',
              [isRTL ? 'left' : 'right']: isRTL ? position?.x || 20 : SCREEN_WIDTH - (position?.x || 20) - 180,
              top: position?.y || 100,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              backgroundColor: appTheme.colors.card,
              shadowColor: appTheme.colors.text,
            },
          ]}
        >
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: appTheme.colors.divider },
                isRTL && styles.menuItemRtl,
              ]}
              onPress={() => {
                item.onPress();
                onClose();
              }}
            >
              <Ionicons name={item.icon} size={18} color={item.color} />
              <Text style={[styles.menuItemText, { color: item.color }, isRTL && styles.rtlText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// Componente per richiesta di follow con pulsanti accetta/rifiuta
const FollowRequestItem = ({ notification, isRTL, strings, onPress, onAccept, onReject, isNew }) => {
  const { theme: appTheme } = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(isNew ? -20 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHandled, setIsHandled] = useState(false);

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isNew]);

  const handleAccept = async () => {
    if (isProcessing || isHandled) return;
    setIsProcessing(true);
    
    // Animazione feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    await onAccept(notification);
    setIsProcessing(false);
    setIsHandled(true);
  };

  const handleReject = async () => {
    if (isProcessing || isHandled) return;
    setIsProcessing(true);
    await onReject(notification);
    setIsProcessing(false);
    setIsHandled(true);
  };

  if (isHandled) {
    return (
      <Animated.View style={[styles.followRequestHandled, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="checkmark-circle" size={20} color="#10b981" />
        <Text style={[styles.followRequestHandledText, { color: appTheme.colors.muted }, isRTL && styles.rtlText]}>
          {strings.notifications?.requestHandled || 'Richiesta gestita'}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
      <Pressable
        style={[styles.followRequestItem, isRTL && styles.notificationItemRtl]}
        onPress={onPress}
      >
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
          <Ionicons name="person-add-outline" size={20} color="#10b981" />
        </View>
        <View style={styles.followRequestContent}>
          <Text
            style={[styles.notificationText, isRTL && styles.rtlText, styles.unreadText]}
            numberOfLines={2}
          >
            {notification.message || notification.body}
          </Text>
          <Text style={[styles.timeText, { marginBottom: 8 }, isRTL && styles.rtlText]}>
            {formatTimeAgo(notification.created_at, strings)}
          </Text>
          
          {/* Pulsanti Accetta/Rifiuta */}
          <View style={[styles.followButtons, isRTL && styles.followButtonsRtl]}>
            <TouchableOpacity
              style={[styles.followButton, styles.followButtonAccept]}
              onPress={handleAccept}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                  <Text style={styles.followButtonText}>
                    {strings.notifications?.accept || 'Accetta'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followButton, styles.followButtonReject]}
              onPress={handleReject}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={14} color={appTheme.colors.danger} />
              <Text style={[styles.followButtonText, { color: appTheme.colors.danger }]}>
                {strings.notifications?.reject || 'Rifiuta'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Componente per notifica standard con animazione di entrata
const AnimatedNotificationItem = ({ notification, isRTL, strings, onPress, onOptionsPress, isNew }) => {
  const type = notification.type || 'default';
  const icon = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
  const iconColor = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.default;
  const isUnread = !notification.read;
  
  const fadeAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(isNew ? -30 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(isNew ? 0.95 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isNew]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
      <Pressable
        style={[styles.notificationItem, isRTL && styles.notificationItemRtl]}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
      >
        <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
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
        
        {/* Indicatore non letto e menu */}
        <View style={[styles.notificationRight, isRTL && styles.notificationRightRtl]}>
          {isUnread && <View style={styles.unreadDot} />}
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={onOptionsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#7A869A" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Componente campanella con badge animato
export const NotificationBell = ({ count, onPress, isRTL }) => {
  const { theme: appTheme } = useAppTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Effetto pulse quando cambia il count
  useEffect(() => {
    if (count > 0) {
      Animated.sequence([
        Animated.timing(badgeScaleAnim, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse continuo per notifiche non lette
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [count]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.bellButton}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Animated.View style={{ transform: [{ scale: count > 0 ? pulseAnim : 1 }] }}>
          <Ionicons 
            name={count > 0 ? "notifications" : "notifications-outline"} 
            size={26} 
            color={appTheme.colors.card} 
          />
        </Animated.View>
        {count > 0 && (
          <Animated.View 
            style={[
              styles.bellBadge,
              { 
                backgroundColor: '#ff4757',
                transform: [{ scale: badgeScaleAnim }],
                [isRTL ? 'left' : 'right']: -6,
              },
            ]}
          >
            <Text style={styles.bellBadgeText}>
              {count > 99 ? '99+' : count}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Pannello notifiche principale
const NotificationsPanel = ({ isVisible, onClose, isRTL = false }) => {
  const navigation = useNavigation();
  const { strings } = useLanguage();
  const { theme: appTheme } = useAppTheme();
  const { 
    notifications, 
    unreadCount, 
    refreshNotifications, 
    markAsRead, 
    deleteNotification,
    acceptFollowRequest,
    rejectFollowRequest,
    isInitialized 
  } = useNotifications();
  
  const [newIds, setNewIds] = useState(new Set());
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const prevNotificationsRef = useRef([]);
  
  // Animazioni del pannello
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Anima apertura/chiusura
  useEffect(() => {
    if (isVisible) {
      // Apertura
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Refresh quando si apre
      refreshNotifications(true);
    } else {
      // Chiusura
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  // Traccia nuove notifiche per animazione
  useEffect(() => {
    const currentIds = new Set(notifications.map(n => n.id));
    const prevIds = new Set(prevNotificationsRef.current.map(n => n.id));
    const newlyAdded = new Set([...currentIds].filter(id => !prevIds.has(id)));
    
    if (newlyAdded.size > 0) {
      setNewIds(newlyAdded);
      setTimeout(() => setNewIds(new Set()), 1500);
    }
    
    prevNotificationsRef.current = notifications;
  }, [notifications]);

  const handleNotificationPress = async (notification) => {
    // Segna come letta
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Chiudi pannello
    onClose();

    // Navigazione basata sul tipo (dopo un breve delay per l'animazione)
    setTimeout(() => {
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
    }, 300);
  };

  const handleOptionsPress = (notification, event) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX, y: pageY });
    setSelectedNotification(notification);
    setMenuVisible(true);
  };

  const handleMarkAsRead = async () => {
    if (selectedNotification) {
      await markAsRead(selectedNotification.id);
    }
  };

  const handleDelete = async () => {
    if (selectedNotification) {
      await deleteNotification(selectedNotification.id);
    }
  };

  const handleAcceptFollow = async (notification) => {
    if (notification.data?.followerId) {
      await acceptFollowRequest(notification.data.followerId);
      await markAsRead(notification.id);
    }
  };

  const handleRejectFollow = async (notification) => {
    if (notification.data?.followerId) {
      await rejectFollowRequest(notification.data.followerId);
      await markAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    // Implementa se necessario
  };

  if (!isVisible && !menuVisible) return null;

  const renderNotification = (notification) => {
    if (notification.type === 'follow' && notification.data?.followerId && !notification.read) {
      return (
        <FollowRequestItem
          key={notification.id}
          notification={notification}
          isRTL={isRTL}
          strings={strings}
          onPress={() => handleNotificationPress(notification)}
          onAccept={handleAcceptFollow}
          onReject={handleRejectFollow}
          isNew={newIds.has(notification.id)}
        />
      );
    }

    return (
      <AnimatedNotificationItem
        key={notification.id}
        notification={notification}
        isRTL={isRTL}
        strings={strings.notifications}
        onPress={() => handleNotificationPress(notification)}
        onOptionsPress={(e) => handleOptionsPress(notification, e)}
        isNew={newIds.has(notification.id)}
      />
    );
  };

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View 
        style={[
          styles.backdrop,
          { opacity: backdropOpacity }
        ]}
      >
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Pannello laterale */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateX: isRTL ? -slideAnim : slideAnim }],
            [isRTL ? 'left' : 'right']: 0,
            backgroundColor: appTheme.colors.background,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.panelHeader, { borderBottomColor: appTheme.colors.divider }]}>
          <View style={[styles.panelHeaderLeft, isRTL && styles.panelHeaderLeftRtl]}>
            <Ionicons name="notifications" size={24} color={appTheme.colors.primary} />
            <Text style={[styles.panelHeaderTitle, { color: appTheme.colors.text }, isRTL && styles.rtlText]}>
              {strings.notifications?.title || 'Notifiche'}
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.panelBadge, { backgroundColor: appTheme.colors.danger }]}>
                <Text style={styles.panelBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={appTheme.colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Animated.View style={[styles.panelContent, { opacity: contentOpacity }]}>
          {!isInitialized ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={appTheme.colors.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${appTheme.colors.primary}15` }]}>
                <Ionicons name="notifications-off-outline" size={40} color={appTheme.colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: appTheme.colors.text }, isRTL && styles.rtlText]}>
                {strings.notifications?.emptyTitle || 'Nessuna notifica'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: appTheme.colors.muted }, isRTL && styles.rtlText]}>
                {strings.notifications?.emptySubtitle || 'Resta connesso, ti avviseremo quando arriva qualcosa di nuovo'}
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.notificationsList}
            >
              {notifications.map(renderNotification)}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>

      {/* Menu opzioni */}
      <NotificationOptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onMarkAsRead={handleMarkAsRead}
        onDelete={handleDelete}
        isRead={selectedNotification?.read}
        position={menuPosition}
        isRTL={isRTL}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  backdropPressable: {
    flex: 1,
  },

  // Pannello
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: Math.min(SCREEN_WIDTH * 0.85, 380),
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },

  // Header
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  panelHeaderLeftRtl: {
    flexDirection: 'row-reverse',
  },
  panelHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  panelBadge: {
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  panelBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },

  // Content
  panelContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Lista notifiche
  notificationsList: {
    paddingVertical: 8,
  },

  // Notifica item
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  notificationItemRtl: {
    flexDirection: 'row-reverse',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationText: {
    fontSize: 14,
    color: '#0E141B',
    lineHeight: 20,
  },
  unreadText: {
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: '#7A869A',
  },
  notificationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationRightRtl: {
    flexDirection: 'row-reverse',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0066CC',
  },
  optionsButton: {
    padding: 4,
  },

  // Campanella
  bellButton: {
    padding: 8,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0066CC',
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Menu opzioni
  menuOverlay: {
    flex: 1,
    zIndex: 200,
  },
  menuContainer: {
    borderRadius: 12,
    minWidth: 180,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemRtl: {
    flexDirection: 'row-reverse',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Follow request
  followRequestItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  followRequestContent: {
    flex: 1,
  },
  followButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  followButtonsRtl: {
    flexDirection: 'row-reverse',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    justifyContent: 'center',
  },
  followButtonAccept: {
    backgroundColor: '#10b981',
  },
  followButtonReject: {
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  followRequestHandled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    marginHorizontal: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    marginVertical: 4,
  },
  followRequestHandledText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // RTL
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default NotificationsPanel;

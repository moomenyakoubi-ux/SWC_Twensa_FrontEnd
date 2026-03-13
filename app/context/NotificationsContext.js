import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

const NotificationsContext = createContext({
  unreadCount: 0,
  unreadMessages: 0,
  unreadLikes: 0,
  unreadComments: 0,
  unreadFollows: 0,
  notifications: [],
  refreshNotifications: () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  acceptFollowRequest: async () => {},
  rejectFollowRequest: async () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadLikes, setUnreadLikes] = useState(0);
  const [unreadComments, setUnreadComments] = useState(0);
  const [unreadFollows, setUnreadFollows] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const channelRef = useRef(null);
  const lastFetchRef = useRef(0);

  // Calcola i conteggi per tipo
  const calculateUnreadCounts = useCallback((notifs) => {
    const counts = {
      messages: 0,
      likes: 0,
      comments: 0,
      follows: 0,
      total: 0
    };
    
    notifs.forEach(n => {
      if (!n.read) {
        counts.total++;
        switch (n.type) {
          case 'message':
            counts.messages++;
            break;
          case 'like':
            counts.likes++;
            break;
          case 'comment':
            counts.comments++;
            break;
          case 'follow':
            counts.follows++;
            break;
        }
      }
    });
    
    return counts;
  }, []);

  // Fetch notifiche dal server
  const fetchNotifications = useCallback(async (force = false) => {
    // Rate limiting: max 1 chiamata ogni 5 secondi (tranne force)
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 5000) {
      return;
    }
    lastFetchRef.current = now;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`${API_BASE}/api/notifications?limit=50`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const notifs = data.notifications || [];
      
      setNotifications(notifs);
      
      const counts = calculateUnreadCounts(notifs);
      setUnreadCount(counts.total);
      setUnreadMessages(counts.messages);
      setUnreadLikes(counts.likes);
      setUnreadComments(counts.comments);
      setUnreadFollows(counts.follows);
      
      // Aggiorna badge app icon (iOS)
      if (counts.total > 0) {
        Notifications.setBadgeCountAsync(counts.total);
      }
    } catch (err) {
      console.error('[NotificationsContext] Fetch error:', err);
    }
  }, [calculateUnreadCounts]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        // Aggiorna stato locale
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        
        // Ricalcola conteggi
        const newNotifs = notifications.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        );
        const counts = calculateUnreadCounts(newNotifs);
        setUnreadCount(counts.total);
        setUnreadMessages(counts.messages);
        setUnreadLikes(counts.likes);
        setUnreadComments(counts.comments);
        setUnreadFollows(counts.follows);
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationsContext] Mark as read error:', err);
      return false;
    }
  }, [notifications, calculateUnreadCounts]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        setUnreadMessages(0);
        setUnreadLikes(0);
        setUnreadComments(0);
        setUnreadFollows(0);
        Notifications.setBadgeCountAsync(0);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationsContext] Mark all as read error:', err);
      return false;
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        // Rimuovi dalla lista locale
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        // Ricalcola conteggi
        const newNotifs = notifications.filter(n => n.id !== notificationId);
        const counts = calculateUnreadCounts(newNotifs);
        setUnreadCount(counts.total);
        setUnreadMessages(counts.messages);
        setUnreadLikes(counts.likes);
        setUnreadComments(counts.comments);
        setUnreadFollows(counts.follows);
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationsContext] Delete notification error:', err);
      return false;
    }
  }, [notifications, calculateUnreadCounts]);

  // Accept follow request
  const acceptFollowRequest = useCallback(async (followerId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const response = await fetch(`${API_BASE}/api/follows/accept`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ followerId }),
      });

      if (response.ok) {
        // Aggiorna eventuali notifiche di follow pending
        setNotifications(prev => 
          prev.map(n => 
            n.type === 'follow' && n.data?.followerId === followerId
              ? { ...n, read: true, data: { ...n.data, accepted: true } }
              : n
          )
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationsContext] Accept follow error:', err);
      return false;
    }
  }, []);

  // Reject follow request
  const rejectFollowRequest = useCallback(async (followerId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const response = await fetch(`${API_BASE}/api/follows/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ followerId }),
      });

      if (response.ok) {
        // Rimuovi la relazione di follow
        setNotifications(prev => 
          prev.filter(n => !(n.type === 'follow' && n.data?.followerId === followerId))
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationsContext] Reject follow error:', err);
      return false;
    }
  }, []);

  // Setup Realtime
  useEffect(() => {
    let isMounted = true;
    
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !isMounted) return;
      
      const userId = session.user.id;
      
      // Rimuovi channel precedente se esiste
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      channelRef.current = supabase
        .channel('global-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification_logs',
          },
          (payload) => {
            if (payload.new?.user_id === userId) {
              console.log('[NotificationsContext] New realtime notification:', payload.new);
              
              // Aggiungi alla lista
              setNotifications(prev => {
                if (prev.some(n => n.id === payload.new.id)) return prev;
                return [payload.new, ...prev].slice(0, 50);
              });
              
              // Aggiorna conteggi
              setUnreadCount(prev => prev + 1);
              switch (payload.new.type) {
                case 'message':
                  setUnreadMessages(prev => prev + 1);
                  break;
                case 'like':
                  setUnreadLikes(prev => prev + 1);
                  break;
                case 'comment':
                  setUnreadComments(prev => prev + 1);
                  break;
                case 'follow':
                  setUnreadFollows(prev => prev + 1);
                  break;
              }
              
              // Incrementa badge
              Notifications.getBadgeCountAsync().then(count => {
                Notifications.setBadgeCountAsync(count + 1);
              });
            }
          }
        )
        .subscribe((status) => {
          console.log('[NotificationsContext] Realtime status:', status);
        });
    };

    setupRealtime();
    fetchNotifications(true);
    setIsInitialized(true);
    
    // Polling di fallback ogni 60 secondi
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 60000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchNotifications]);

  const value = {
    unreadCount,
    unreadMessages,
    unreadLikes,
    unreadComments,
    unreadFollows,
    notifications,
    refreshNotifications: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    acceptFollowRequest,
    rejectFollowRequest,
    isInitialized,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import WebSidebar, { WEB_SIDE_MENU_WIDTH } from '../components/WebSidebar';
import { WEB_TAB_BAR_WIDTH } from '../components/WebTabBar';
import useSession from '../auth/useSession';
import { supabase } from '../lib/supabase';
import { askAI } from '../api/ai';
import {
  fetchMessages,
  fetchParticipants,
  fetchProfiles,
  listConversations,
  sendMessage,
  subscribeToMessages,
} from '../services/chatService';

const backgroundImage = require('../images/image2.png');
const DOT_COLOR = '#333';

const getInitials = (value) =>
  String(value || '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const TWENSAI_CHAT_ID = 'twensai_ai';

const ChatComposer = React.memo(
  ({
    value,
    onChangeText,
    onSubmit,
    placeholder,
    isRTL,
    sending,
    isWeb,
  }) => (
    <View style={styles.inputRow}>
      <View style={[styles.inputRowInner, isWeb && styles.inputRowWeb]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={onSubmit}
          textAlign={isRTL ? 'right' : 'left'}
          writingDirection={isRTL ? 'rtl' : 'ltr'}
        />
        <TouchableOpacity style={styles.sendButton} onPress={onSubmit} disabled={sending}>
          {sending ? (
            <ActivityIndicator size="small" color={theme.colors.card} />
          ) : (
            <Ionicons name="send" size={20} color={theme.colors.card} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  ),
);

const ChatScreen = ({ navigation, route }) => {
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { strings, isRTL, language } = useLanguage();
  const { user } = useSession();
  const chatStrings = strings.chat;
  const menuStrings = strings.menu;
  const sidebarTitle = strings.home?.greeting || chatStrings.title;
  const [activeChatId, setActiveChatId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageAt, setOldestMessageAt] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiSending, setAiSending] = useState(false);
  const scrollRef = useRef(null);
  const aiScrollRef = useRef(null);
  const shouldScrollRef = useRef(true);
  const typingTimeoutRef = useRef(null);
  const presenceRef = useRef(null);

  const conversationIdParam = route?.params?.conversationId;
  const isAiMode = activeChatId === TWENSAI_CHAT_ID;
  const aiRtl = isRTL;
  const safeTopInset = Number.isFinite(insets?.top) ? insets.top : 0;
  const contentTopPadding = (isWeb ? 0 : safeTopInset) + 12;

  useEffect(() => {
    if (conversationIdParam) {
      setActiveChatId(conversationIdParam);
    }
  }, [conversationIdParam]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    setConversationsLoading(true);
    setConversationsError(null);
    try {
      const list = await listConversations(user.id);
      const ids = list.map((item) => item.id).filter(Boolean);
      const participantsMap = await fetchParticipants(ids, user.id);
      const otherUserIds = Array.from(
        new Set(Object.values(participantsMap).filter(Boolean)),
      );
      const profilesMap = await fetchProfiles(otherUserIds);
      const mapped = list.map((item) => {
        const otherUserId = participantsMap[item.id];
        const profile = profilesMap[otherUserId] || {};
        return {
          id: item.id,
          lastMessageText: item.last_message_text || '',
          lastMessageAt: item.last_message_at,
          otherUserId,
          name: profile.full_name || 'Utente',
          avatarUrl: profile.avatar_url || null,
        };
      });
      setConversations(mapped);
    } catch (err) {
      setConversationsError(err);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  const twensAiPreview = useMemo(() => {
    const lastMessage = aiMessages[aiMessages.length - 1];
    if (!lastMessage) return 'Chiedimi qualsiasi cosa';
    return lastMessage.text || 'Chiedimi qualsiasi cosa';
  }, [aiMessages]);

  const twensAiChat = useMemo(
    () => ({
      id: TWENSAI_CHAT_ID,
      lastMessageText: twensAiPreview,
      lastMessageAt: null,
      otherUserId: null,
      name: 'TwensAI',
      avatarUrl: null,
    }),
    [twensAiPreview],
  );

  const activeChat = useMemo(() => {
    if (activeChatId === TWENSAI_CHAT_ID) return twensAiChat;
    return conversations.find((chat) => chat.id === activeChatId);
  }, [activeChatId, conversations, twensAiChat]);

  const activeChatSubtitle = activeChat?.lastMessageAt
    ? `${chatStrings.statusOffline} ${formatTime(activeChat.lastMessageAt)}`
    : chatStrings.statusOffline;

  const updateConversationPreview = useCallback((message, conversationId) => {
    if (!message || !conversationId) return;
    setConversations((prev) => {
      const updated = prev.map((chat) =>
        chat.id === conversationId
          ? {
              ...chat,
              lastMessageText: message.body || chat.lastMessageText,
              lastMessageAt: message.created_at || chat.lastMessageAt,
            }
          : chat,
      );
      return updated.slice().sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    });
  }, []);

  useEffect(() => {
    if (!activeChatId || !user?.id || activeChatId === TWENSAI_CHAT_ID) return;
    let isMounted = true;
    setMessagesLoading(true);
    setMessagesError(null);
    setMessages([]);
    setHasMoreMessages(true);
    setOldestMessageAt(null);
    setInput('');
    shouldScrollRef.current = true;

    const load = async () => {
      try {
        const fetched = await fetchMessages(activeChatId, 30);
        if (!isMounted) return;
        setMessages(fetched);
        setHasMoreMessages(fetched.length === 30);
        setOldestMessageAt(fetched[0]?.created_at || null);
      } catch (err) {
        if (isMounted) {
          setMessagesError(err);
          setMessages([]);
          setHasMoreMessages(false);
          setOldestMessageAt(null);
        }
      } finally {
        if (isMounted) {
          setMessagesLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [activeChatId, user?.id]);

  useEffect(() => {
    if (!activeChatId || activeChatId === TWENSAI_CHAT_ID) return;
    const unsubscribe = subscribeToMessages(activeChatId, (newMessage) => {
      if (!newMessage?.id) return;
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === newMessage.id)) return prev;
        return [...prev, newMessage].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });
      });
      updateConversationPreview(newMessage, activeChatId);
    });
    return unsubscribe;
  }, [activeChatId, updateConversationPreview]);

  useEffect(() => {
    if (!activeChatId || !user?.id || activeChatId === TWENSAI_CHAT_ID) return;
    const presence = supabase.channel(`presence:${activeChatId}`, {
      config: { presence: { key: user.id } },
    });
    presenceRef.current = presence;

    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState();
      const otherKeys = Object.keys(state).filter((key) => key !== user.id);
      const someoneTyping = otherKeys.some((key) =>
        (state[key] || []).some((entry) => Boolean(entry?.typing)),
      );
      setOtherTyping(someoneTyping);
    });

    presence.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        presence.track({ typing: false, ts: Date.now() });
      }
    });

    return () => {
      presence.track({ typing: false, ts: Date.now() });
      supabase.removeChannel(presence);
      presenceRef.current = null;
      setOtherTyping(false);
    };
  }, [activeChatId, user?.id]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!shouldScrollRef.current) return;
    if (messages.length === 0) return;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (aiMessages.length === 0) return;
    aiScrollRef.current?.scrollToEnd({ animated: true });
  }, [aiMessages]);

  const handleOpenChat = (chatId) => {
    setActiveChatId(chatId);
  };

  const handleSend = async (overrideText) => {
    if (!activeChatId || !user?.id || activeChatId === TWENSAI_CHAT_ID) return;
    const textToSend = (overrideText ?? input).trim();
    if (!textToSend || sending) return;
    setSending(true);
    shouldScrollRef.current = true;
    try {
      const message = await sendMessage(activeChatId, textToSend, user.id);
      if (message) {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === message.id)) return prev;
          return [...prev, message].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return aTime - bTime;
          });
        });
        updateConversationPreview(message, activeChatId);
      }
      setInput('');
      presenceRef.current?.track({ typing: false, ts: Date.now() });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (err) {
      setMessagesError(err);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = useCallback(
    (value) => {
      setInput(value);
      if (!activeChatId || !user?.id || activeChatId === TWENSAI_CHAT_ID) return;
      presenceRef.current?.track({ typing: true, ts: Date.now() });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        presenceRef.current?.track({ typing: false, ts: Date.now() });
      }, 1000);
    },
    [activeChatId, user?.id],
  );

  const handleAiSend = async (overrideText) => {
    const textToSend = (overrideText ?? aiInput).trim();
    if (!textToSend || aiSending) return;
    setAiSending(true);
    const timestamp = new Date().toISOString();
    const userMessage = {
      id: `ai-user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      createdAt: timestamp,
    };
    const placeholderId = `ai-assistant-${Date.now()}`;
    const placeholder = {
      id: placeholderId,
      role: 'assistant',
      text: chatStrings.aiTyping || 'Sto scrivendo...',
      createdAt: timestamp,
      meta: { loading: true },
    };
    setAiMessages((prev) => [...prev, userMessage, placeholder]);
    setAiInput('');

    try {
      const data = await askAI(textToSend, { lang: language });
      if (__DEV__) {
        console.log('[askAI] response intent', data?.intent);
      }
      const assistantMessage = {
        id: placeholderId,
        role: 'assistant',
        text: data?.answer || '',
        createdAt: new Date().toISOString(),
        meta: {
          intent: data?.intent,
          sources: data?.sources || [],
          showSources: data?.show_sources === true,
        },
      };
      setAiMessages((prev) => prev.map((msg) => (msg.id === placeholderId ? assistantMessage : msg)));
    } catch (err) {
      const errorMessage = {
        id: placeholderId,
        role: 'assistant',
        text:
          chatStrings.aiError ||
          'Errore: AI non disponibile in questo momento.',
        createdAt: new Date().toISOString(),
      };
      setAiMessages((prev) => prev.map((msg) => (msg.id === placeholderId ? errorMessage : msg)));
    } finally {
      setAiSending(false);
    }
  };

  const handleAiInputChange = useCallback((value) => {
    setAiInput(value);
  }, []);

  const handleLoadOlder = async () => {
    if (!activeChatId || !hasMoreMessages || loadingOlder) return;
    setLoadingOlder(true);
    shouldScrollRef.current = false;
    try {
      const older = await fetchMessages(activeChatId, 30, oldestMessageAt);
      if (older.length) {
        setMessages((prev) => [...older, ...prev]);
        setOldestMessageAt(older[0]?.created_at || oldestMessageAt);
      }
      setHasMoreMessages(older.length === 30);
    } catch (err) {
      setMessagesError(err);
    } finally {
      setLoadingOlder(false);
      shouldScrollRef.current = true;
    }
  };

  const renderBubble = (message) => {
    const isUser = message.sender_id ? message.sender_id === user?.id : message.sender === 'user';
    const body = message.body ?? message.text ?? '';
    return (
      <View key={message.id} style={[styles.bubbleWrapper, isUser ? styles.alignEnd : styles.alignStart]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.userText : styles.aiText,
              isRTL && styles.rtlText,
            ]}
          >
            {body}
          </Text>
        </View>
      </View>
    );
  };

  const renderAiBubble = (message) => {
    const isUser = message.role === 'user';
    const body = message.text ?? '';
    const isLoading = message.meta?.loading === true;
    const showDebug = __DEV__ && !isUser && message.meta;
    const sources = message.meta?.sources || [];
    const shouldShowSources = message.meta?.showSources === true && sources.length > 0;
    return (
      <View
        key={message.id}
        style={[
          styles.bubbleStack,
          isUser ? styles.bubbleStackEnd : styles.bubbleStackStart,
        ]}
      >
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          {isLoading ? (
            <TypingDots />
          ) : (
            <Text
              style={[
                styles.bubbleText,
                isUser ? styles.userText : styles.aiText,
                aiRtl && styles.rtlText,
              ]}
            >
              {body}
            </Text>
          )}
        </View>
        {showDebug && shouldShowSources ? (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>{chatStrings.debugSourcesLabel || 'Fonti usate'}:</Text>
            {sources.map((source, index) => (
              <Text key={`${message.id}-source-${index}`} style={styles.debugItem}>
                {source?.title || 'Senza titolo'} ({Number(source?.similarity || 0).toFixed(2)})
                {source?.source ? ` · ${source.source}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const TypingDots = () => {
    const dotScales = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;

    useEffect(() => {
      const animations = dotScales.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 120),
            Animated.timing(anim, {
              toValue: 1,
              duration: 280,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.4,
              duration: 280,
              useNativeDriver: true,
            }),
          ]),
        ),
      );

      animations.forEach((animation) => animation.start());
      return () => animations.forEach((animation) => animation.stop());
    }, [dotScales]);

    return (
      <View style={styles.typingDots}>
        {dotScales.map((scale, index) => (
          <Animated.View key={`dot-${index}`} style={[styles.typingDot, { transform: [{ scale }] }]} />
        ))}
      </View>
    );
  };

  const displayedChats = useMemo(
    () => [twensAiChat, ...conversations.filter((chat) => chat.id !== TWENSAI_CHAT_ID)],
    [conversations, twensAiChat],
  );

  const backButton = activeChat ? (
    <TouchableOpacity
      onPress={() => handleOpenChat(null)}
      style={styles.headerBackButton}
      accessibilityLabel={chatStrings.backToList || 'Tutte le chat'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={isRTL ? 'arrow-forward' : 'arrow-back'}
        size={20}
        color={theme.colors.card}
      />
    </TouchableOpacity>
  ) : null;

  const ChatList = () => (
    <View
      style={[
        styles.listContainer,
        { paddingTop: contentTopPadding },
        isWeb && styles.webContentPadding,
        isWeb && styles.webMaxWidth,
      ]}
    >
      {conversationsLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.card} />
          <Text style={[styles.listMuted, isRTL && styles.rtlText]}>Caricamento chat...</Text>
        </View>
      ) : null}
      {conversationsError ? (
        <Text style={[styles.errorText, isRTL && styles.rtlText]}>{conversationsError.message}</Text>
      ) : null}
      <ScrollView contentContainerStyle={styles.chatList} showsVerticalScrollIndicator={false}>
        {displayedChats.map((chat) => (
          <TouchableOpacity
            key={chat.id}
            style={styles.chatCard}
            activeOpacity={0.9}
            onPress={() => handleOpenChat(chat.id)}
          >
            <View style={styles.avatar}>
              {chat.avatarUrl ? (
                <Image source={{ uri: chat.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: theme.colors.secondary }]}
                >
                  <Text style={styles.avatarText}>{getInitials(chat.name)}</Text>
                </View>
              )}
            </View>
            <View style={styles.chatMeta}>
              <View style={[styles.chatHeader, isRTL && styles.rowReverse]}>
                <Text style={[styles.chatName, isRTL && styles.rtlText]}>{chat.name}</Text>
                <Text style={styles.chatStatus}>{formatTime(chat.lastMessageAt)}</Text>
              </View>
              <Text style={[styles.chatSubtitle, isRTL && styles.rtlText]}>{chatStrings.statusOffline}</Text>
              <Text numberOfLines={1} style={[styles.chatLast, isRTL && styles.rtlText]}>
                {chat.lastMessageText}
              </Text>
            </View>
            <View style={styles.openPill}>
              <Ionicons name="arrow-forward" size={18} color={theme.colors.card} />
              <Text style={styles.openPillText}>{chatStrings.openChat}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const aiChatContent = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.chatWrapper,
          { paddingTop: contentTopPadding },
          isWeb && styles.webContentPadding,
          isWeb && styles.webMaxWidth,
        ]}
      >
        {backButton ? <View style={styles.backButtonRow}>{backButton}</View> : null}
        <ScrollView
          ref={aiScrollRef}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
        >
          {aiMessages.length === 0 ? (
            <Text style={[styles.listMuted, aiRtl && styles.rtlText]}>
              {chatStrings.aiEmptyState || 'Inizia una conversazione con TwensAI.'}
            </Text>
          ) : null}
          {aiMessages.map(renderAiBubble)}
        </ScrollView>

        <ChatComposer
          value={aiInput}
          onChangeText={handleAiInputChange}
          onSubmit={() => handleAiSend()}
          placeholder={chatStrings.placeholder}
          isRTL={aiRtl}
          sending={aiSending}
          isWeb={isWeb}
        />
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <ImageBackground
      source={backgroundImage}
      defaultSource={backgroundImage}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={[styles.overlay, isWeb && styles.overlayWeb]}>
        {!activeChat && <ChatList />}

        {activeChat && !isAiMode && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View
              style={[
                styles.chatWrapper,
                { paddingTop: contentTopPadding },
                isWeb && styles.webContentPadding,
                isWeb && styles.webMaxWidth,
              ]}
            >
              {backButton ? <View style={styles.backButtonRow}>{backButton}</View> : null}
              <View style={[styles.chatHero, isRTL && styles.rowReverse]}>
                <View style={styles.avatarLarge}>
                  {activeChat.avatarUrl ? (
                    <Image source={{ uri: activeChat.avatarUrl }} style={styles.avatarLargeImage} />
                  ) : (
                    <View style={[styles.avatarLargeFallback, { backgroundColor: theme.colors.secondary }]}
                    >
                      <Text style={styles.avatarLargeText}>{getInitials(activeChat.name)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.heroMeta}>
                  <Text style={[styles.heroTitle, isRTL && styles.rtlText]}>{activeChat.name}</Text>
                  <Text style={[styles.heroStatus, isRTL && styles.rtlText]}>{activeChatSubtitle}</Text>
                </View>
              </View>

              {messagesError ? (
                <Text style={[styles.errorText, isRTL && styles.rtlText]}>{messagesError.message}</Text>
              ) : null}

              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.messages}
                showsVerticalScrollIndicator={false}
              >
                {hasMoreMessages ? (
                  <TouchableOpacity
                    style={[styles.loadMoreButton, loadingOlder && styles.loadMoreButtonDisabled]}
                    onPress={handleLoadOlder}
                    disabled={loadingOlder}
                  >
                    {loadingOlder ? (
                      <ActivityIndicator size="small" color={theme.colors.card} />
                    ) : (
                      <Text style={styles.loadMoreText}>Carica messaggi precedenti</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {messagesLoading && messages.length === 0 ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={theme.colors.card} />
                    <Text style={[styles.listMuted, isRTL && styles.rtlText]}>Caricamento messaggi...</Text>
                  </View>
                ) : null}
                {!messagesLoading && messages.length === 0 ? (
                  <Text style={[styles.listMuted, isRTL && styles.rtlText]}>Nessun messaggio ancora.</Text>
                ) : null}
                {messages.map(renderBubble)}
              </ScrollView>
              {otherTyping ? (
                <View style={[styles.typingRow, isRTL && styles.rowReverse]}>
                  <TypingDots />
                  <Text style={[styles.typingLabel, isRTL && styles.rtlText]}>Typing...</Text>
                </View>
              ) : null}
              <ChatComposer
                value={input}
                onChangeText={handleInputChange}
                onSubmit={() => handleSend()}
                placeholder={chatStrings.placeholder}
                isRTL={isRTL}
                sending={sending}
                isWeb={isWeb}
              />
            </View>
          </KeyboardAvoidingView>
        )}
        {isAiMode && aiChatContent}
        <WebSidebar
          title={sidebarTitle}
          menuStrings={menuStrings}
          navigation={navigation}
          isRTL={isRTL}
        />
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
    alignSelf: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 27, 51, 0.78)',
  },
  overlayWeb: {
    paddingLeft: WEB_TAB_BAR_WIDTH,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  webMaxWidth: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
  },
  listMuted: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  chatList: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  chatCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: theme.colors.card,
    fontWeight: '800',
    fontSize: 16,
  },
  chatMeta: {
    flex: 1,
    gap: 2,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatName: {
    color: theme.colors.card,
    fontSize: 17,
    fontWeight: '800',
  },
  chatStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  chatSubtitle: {
    color: 'rgba(255,255,255,0.8)',
  },
  chatLast: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  openPillText: {
    color: theme.colors.card,
    fontWeight: '700',
  },
  chatWrapper: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButtonRow: {
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chatHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeImage: {
    width: '100%',
    height: '100%',
  },
  avatarLargeFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: theme.colors.card,
    fontWeight: '800',
    fontSize: 18,
  },
  heroMeta: {
    gap: 4,
  },
  heroTitle: {
    color: theme.colors.card,
    fontSize: 16,
    fontWeight: '800',
  },
  heroStatus: {
    color: 'rgba(255,255,255,0.7)',
  },
  messages: {
    flexGrow: 1,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  bubbleWrapper: {
    flexDirection: 'row',
  },
  bubbleStack: {
    flexDirection: 'column',
    maxWidth: '100%',
  },
  bubbleStackStart: {
    alignItems: 'flex-start',
  },
  bubbleStackEnd: {
    alignItems: 'flex-end',
  },
  alignStart: {
    justifyContent: 'flex-start',
  },
  alignEnd: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  bubbleUser: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: theme.radius.sm,
  },
  bubbleAi: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomLeftRadius: theme.radius.sm,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: theme.colors.card,
  },
  aiText: {
    color: theme.colors.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadow.card,
  },
  inputRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  inputRowWeb: {
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: theme.colors.text,
  },
  sendButton: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  typingLabel: {
    color: theme.colors.card,
    fontSize: 13,
    fontWeight: '600',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DOT_COLOR,
    marginHorizontal: 2,
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreText: {
    color: theme.colors.card,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  debugCard: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  debugTitle: {
    color: theme.colors.card,
    fontSize: 12,
    fontWeight: '700',
  },
  debugItem: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
  },
  debugMuted: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  webContentPadding: {
    paddingRight: theme.spacing.lg + WEB_SIDE_MENU_WIDTH,
    paddingLeft: theme.spacing.lg + WEB_TAB_BAR_WIDTH,
  },
});

export default ChatScreen;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import SectionHeader from '../components/SectionHeader';
import PostCard from '../components/PostCard';
import OfficialPostCard from '../components/OfficialPostCard';
import SponsoredCard from '../components/SponsoredCard';
import EventNewsCard from '../components/EventNewsCard';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import { WEB_SIDE_MENU_WIDTH } from '../components/WebSidebar';
import { WEB_TAB_BAR_WIDTH } from '../components/WebTabBar';
import TunisiaFlagIcon from '../components/TunisiaFlagIcon';
import HomeIcon from '../components/HomeIcon';
import { supabase } from '../lib/supabase';
import { fetchHomeFeed } from '../services/contentApi';

const backgroundImage = require('../images/image1.png');
const HOME_PAGE_SIZE = 20;
const EVENT_NEWS_DETAIL_ROUTES = ['EventNewsDetail', 'NewsDetail', 'EventDetail'];
const resolveFeedItemType = (item) => {
  const rawType = String(item?.type || '').trim().toLowerCase();
  if (rawType) return rawType;
  const rawKind = String(item?.kind || '').trim().toLowerCase();
  if (rawKind && rawKind !== 'event_news') return rawKind;
  if (rawKind === 'event_news') {
    const hasEventHints = Boolean(item?.starts_at || item?.location);
    return hasEventHints ? 'event' : 'news';
  }
  if (item?.authorId || item?.content) return 'post';
  if (item?.sponsor_name) return 'sponsored';
  if (item?.target_url) return 'official';
  return 'unknown';
};

const buildFeedItemKey = (item) => {
  const type = resolveFeedItemType(item);
  const id = String(item?.id ?? '').trim();
  return `${type}_${id}`;
};

const dedupeFeedItems = (items) => {
  const map = new Map();
  items.forEach((item) => {
    if (!item?.id) return;
    const key = buildFeedItemKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

const normalizeExternalUrl = (targetUrl) => {
  const raw = String(targetUrl || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const resolveEventNewsDetailNavigation = (navigation) => {
  let current = navigation;
  while (current) {
    const routeNames = current?.getState?.()?.routeNames;
    if (Array.isArray(routeNames)) {
      const routeName = EVENT_NEWS_DETAIL_ROUTES.find((candidate) => routeNames.includes(candidate));
      if (routeName) return { navigator: current, routeName };
    }
    current = current?.getParent?.();
  }
  return null;
};

const HomeScreen = ({ navigation }) => {
  const isWeb = Platform.OS === 'web';
  const { strings, isRTL } = useLanguage();
  const homeStrings = strings.home;
  const menuStrings = strings.menu;
  const retryLabel = strings.travel?.retryLabel || 'Riprova';

  const [homeFeedItems, setHomeFeedItems] = useState([]);
  const [homeFeedError, setHomeFeedError] = useState(null);
  const [initialFeedLoading, setInitialFeedLoading] = useState(true);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sideMenuWidth = isWeb ? WEB_SIDE_MENU_WIDTH : 280;
  const slideAnim = useRef(new Animated.Value(isWeb ? 1 : 0)).current;
  const requestInFlightRef = useRef(false);
  const feedOffsetRef = useRef(0);
  const hasMoreFeedRef = useRef(true);
  const feedItemsCountRef = useRef(0);
  const eventNewsDetailTarget = useMemo(() => resolveEventNewsDetailNavigation(navigation), [navigation]);
  const hasEventNewsDetailRoute = Boolean(eventNewsDetailTarget?.routeName);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isMenuOpen ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isMenuOpen, slideAnim]);

  const showSoftError = useCallback((message) => {
    const text = message || 'Non siamo riusciti ad aggiornare il feed. Riprova.';
    if (Platform.OS === 'web') return;
    Alert.alert(homeStrings.communityPosts, text);
  }, [homeStrings.communityPosts]);

  const openExternalLink = useCallback(
    async (targetUrl) => {
      const normalized = normalizeExternalUrl(targetUrl);
      if (!normalized) return;

      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.open(normalized, '_blank', 'noopener,noreferrer');
          return;
        }

        await Linking.openURL(normalized);
      } catch (_error) {
        showSoftError('Impossibile aprire il link al momento.');
      }
    },
    [showSoftError],
  );

  const loadHomeFeed = useCallback(
    async ({ reset = false, silent = false } = {}) => {
      if (requestInFlightRef.current) return;
      if (!reset && !hasMoreFeedRef.current) return;

      requestInFlightRef.current = true;
      const nextOffset = reset ? 0 : feedOffsetRef.current;
      const hasExistingItems = feedItemsCountRef.current > 0;

      if (reset) {
        setRefreshingFeed(hasExistingItems);
        if (!hasExistingItems) setInitialFeedLoading(true);
      } else if (nextOffset > 0) {
        setLoadingMoreFeed(true);
      } else {
        setInitialFeedLoading(true);
      }

      try {
        const response = await fetchHomeFeed({
          limit: HOME_PAGE_SIZE,
          offset: nextOffset,
        });
        const incoming = Array.isArray(response?.items) ? response.items : [];
        const nextHasMore = incoming.length > 0 && Boolean(response?.hasMore);
        const nextOffsetValue =
          typeof response?.nextOffset === 'number' ? response.nextOffset : nextOffset + HOME_PAGE_SIZE;

        setHomeFeedError(null);
        hasMoreFeedRef.current = nextHasMore;
        feedOffsetRef.current = nextOffsetValue;

        if (reset) {
          const deduped = dedupeFeedItems(incoming);
          feedItemsCountRef.current = deduped.length;
          setHomeFeedItems(deduped);
        } else {
          setHomeFeedItems((prev) => {
            const merged = dedupeFeedItems([...prev, ...incoming]);
            feedItemsCountRef.current = merged.length;
            return merged;
          });
        }
      } catch (requestError) {
        if (requestError?.code === 'AUTH_REQUIRED') {
          await supabase.auth.signOut();
          return;
        }
        setHomeFeedError(requestError);
        if (!silent) {
          showSoftError(requestError?.message);
        }
      } finally {
        requestInFlightRef.current = false;
        setInitialFeedLoading(false);
        setRefreshingFeed(false);
        setLoadingMoreFeed(false);
      }
    },
    [showSoftError],
  );

  useFocusEffect(
    React.useCallback(() => {
      loadHomeFeed({ reset: true, silent: true });
    }, [loadHomeFeed]),
  );

  const handleRefresh = useCallback(() => {
    feedOffsetRef.current = 0;
    hasMoreFeedRef.current = true;
    loadHomeFeed({ reset: true });
  }, [loadHomeFeed]);

  const handleEndReached = useCallback(() => {
    if (initialFeedLoading || refreshingFeed || loadingMoreFeed) return;
    if (!hasMoreFeedRef.current) return;
    loadHomeFeed();
  }, [initialFeedLoading, loadHomeFeed, loadingMoreFeed, refreshingFeed]);

  const keyExtractor = useCallback((item) => buildFeedItemKey(item), []);

  const openEventNewsItem = useCallback(
    (item) => {
      const targetUrl = String(item?.external_url || '').trim();
      if (targetUrl) {
        openExternalLink(targetUrl);
        return;
      }
      if (!eventNewsDetailTarget) return;
      eventNewsDetailTarget.navigator.navigate(eventNewsDetailTarget.routeName, {
        eventNewsId: item.id,
        item,
      });
    },
    [eventNewsDetailTarget, openExternalLink],
  );

  const renderFeedItem = useCallback(
    ({ item }) => {
      const type = resolveFeedItemType(item);
      const normalizedKind = String(item?.kind || '').trim().toLowerCase();
      const isEventNews =
        normalizedKind === 'event_news' ||
        normalizedKind === 'event' ||
        normalizedKind === 'news' ||
        type === 'event' ||
        type === 'news';

      if (isEventNews) {
        const hasExternalUrl = Boolean(String(item?.external_url || '').trim());
        const onPress = hasExternalUrl || hasEventNewsDetailRoute ? () => openEventNewsItem(item) : undefined;
        return (
          <View style={[styles.cmsItemWrap, isWeb && styles.cmsItemWrapWeb]}>
            <EventNewsCard
              item={item}
              isRTL={isRTL}
              onPress={onPress}
              accessibilityRole={hasExternalUrl ? 'link' : 'button'}
            />
          </View>
        );
      }

      if (item.kind === 'official') {
        return (
          <OfficialPostCard item={item} isRTL={isRTL} onPressTargetUrl={openExternalLink} />
        );
      }

      if (item.kind === 'sponsored') {
        return (
          <SponsoredCard item={item} isRTL={isRTL} onPressTargetUrl={openExternalLink} />
        );
      }

      if (item.kind !== 'post') return null;

      return (
        <PostCard
          post={item}
          isRTL={isRTL}
          onPressAuthor={
            item.authorId ? () => navigation.navigate('PublicProfile', { profileId: item.authorId }) : undefined
          }
        />
      );
    },
    [hasEventNewsDetailRoute, isRTL, isWeb, navigation, openEventNewsItem, openExternalLink],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <SectionHeader title={homeStrings.communityPosts} isRTL={isRTL} />
        {homeFeedError && homeFeedItems.length > 0 ? (
          <View style={styles.feedErrorBox}>
            <Text style={[styles.feedErrorText, isRTL && styles.rtlText]}>
              {homeFeedError?.message || 'Errore caricamento feed.'}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => loadHomeFeed({ reset: true })}>
              <Text style={styles.retryButtonText}>{retryLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [homeFeedError, homeFeedItems.length, homeStrings.communityPosts, isRTL, loadHomeFeed, retryLabel],
  );

  const listEmpty = useMemo(() => {
    if (initialFeedLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>Caricamento feed...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
          {homeFeedError ? homeFeedError.message : 'Nessun contenuto disponibile per ora.'}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => loadHomeFeed({ reset: true })}>
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </Pressable>
      </View>
    );
  }, [homeFeedError, initialFeedLoading, isRTL, loadHomeFeed, retryLabel]);

  const listFooter = useMemo(() => {
    if (!loadingMoreFeed) {
      return <View style={styles.footerSpacer} />;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [loadingMoreFeed]);

  return (
    <ImageBackground
      source={backgroundImage}
      defaultSource={backgroundImage}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={[styles.header, isRTL && styles.headerRtl, isWeb && styles.headerWeb]}>
          <View style={styles.headerText}>
            <View style={[styles.logoContainer, isRTL && styles.logoContainerRtl]}>
              <HomeIcon size={48} />
            </View>
            <View style={[styles.greetingContainer, isRTL && styles.greetingContainerRtl]}>
              <TunisiaFlagIcon size={28} />
              <Text style={[styles.greeting, isRTL && styles.rtlText]}>{homeStrings.greeting}</Text>
            </View>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{homeStrings.subtitle}</Text>
          </View>
          {!isWeb ? (
            <TouchableOpacity
              accessibilityLabel={menuStrings.language}
              style={styles.menuButton}
              onPress={() => setIsMenuOpen(true)}
            >
              <Ionicons name="menu" size={26} color={theme.colors.card} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={homeFeedItems}
          keyExtractor={keyExtractor}
          renderItem={renderFeedItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          contentContainerStyle={[
            styles.content,
            isWeb && {
              paddingRight: sideMenuWidth + theme.spacing.lg,
              paddingLeft: WEB_TAB_BAR_WIDTH + theme.spacing.lg,
            },
          ]}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          refreshing={refreshingFeed}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />

        {isMenuOpen && !isWeb && (
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setIsMenuOpen(false)} />
        )}
        {!isWeb ? (
          <Animated.View
            style={[
              styles.sideMenu,
              { width: sideMenuWidth },
              {
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [sideMenuWidth, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.menuTitleContainer, isRTL && styles.menuTitleContainerRtl]}>
              <TunisiaFlagIcon size={28} />
              <Text style={[styles.menuTitle, isRTL && styles.rtlText]}>{homeStrings.greeting}</Text>
            </View>
            <View style={styles.menuItems}>
              {[
                { label: menuStrings.addContact, icon: 'person-add', route: 'AddContact' },
                { label: menuStrings.accountSettings, icon: 'settings', route: 'AccountSettings' },
                { label: menuStrings.language, icon: 'globe', route: 'Lingua' },
                { label: menuStrings.privacy, icon: 'shield-checkmark', route: 'PrivacyPolicy' },
                { label: menuStrings.terms, icon: 'document-text', route: 'Termini' },
                { label: menuStrings.copyright, icon: 'ribbon', route: 'Copyright' },
                { label: menuStrings.cookies, icon: 'ice-cream', route: 'CookiePolicy' },
                { label: menuStrings.aiUsage, icon: 'sparkles', route: 'AiUsage' },
                { label: menuStrings.support, icon: 'call', route: 'Support' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.menuItem, isRTL && styles.menuItemRtl]}
                  onPress={() => {
                    setIsMenuOpen(false);
                    navigation.navigate(item.route);
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={theme.colors.secondary} />
                  <Text style={[styles.menuLabel, isRTL && styles.rtlText]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
    alignSelf: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 27, 51, 0.6)',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl + theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  headerWeb: {
    paddingLeft: theme.spacing.lg + WEB_TAB_BAR_WIDTH,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  headerText: {
    flex: 1,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl + 40,
  },
  cmsItemWrap: {
    width: '100%',
  },
  cmsItemWrapWeb: {
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  logoContainerRtl: {
    alignItems: 'flex-end',
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  greetingContainerRtl: {
    flexDirection: 'row-reverse',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.card,
  },
  subtitle: {
    color: theme.colors.card,
    opacity: 0.9,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  feedErrorBox: {
    backgroundColor: 'rgba(214, 69, 69, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214, 69, 69, 0.25)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  feedErrorText: {
    color: theme.colors.danger || '#d64545',
    fontWeight: '600',
    flex: 1,
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.card,
    opacity: 0.95,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  footerLoader: {
    paddingVertical: theme.spacing.md,
  },
  footerSpacer: {
    height: theme.spacing.md,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sideMenu: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 280,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl + theme.spacing.sm,
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
    gap: theme.spacing.lg,
  },
  menuTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: Platform.OS === 'android' ? theme.spacing.sm : 0,
  },
  menuTitleContainerRtl: {
    flexDirection: 'row-reverse',
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  menuItems: {
    gap: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  menuItemRtl: {
    flexDirection: 'row-reverse',
  },
  menuLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
});

export default HomeScreen;

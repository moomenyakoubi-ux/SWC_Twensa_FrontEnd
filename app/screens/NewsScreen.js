import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import WebSidebar, { WEB_SIDE_MENU_WIDTH } from '../components/WebSidebar';
import { WEB_TAB_BAR_WIDTH } from '../components/WebTabBar';
import ResponsiveMedia from '../components/ResponsiveMedia';
import useSession from '../auth/useSession';
import { fetchEventsNews } from '../services/contentApi';

const backgroundImage = require('../images/image1.png');
const PAGE_SIZE = 10;
const DEFAULT_CONTENT_ASPECT_RATIO = 4 / 5;

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getMediaUrl = (media) =>
  media?.publicUrl ||
  media?.public_url ||
  media?.url ||
  media?.image_url ||
  media?.image ||
  null;

const getBestMedia = (item) => {
  const firstMedia = Array.isArray(item?.mediaItems) && item.mediaItems.length > 0
    ? item.mediaItems[0]
    : null;

  const sourceUri = firstMedia
    ? getMediaUrl(firstMedia)
    : item?.publicUrl || item?.image_url || item?.image || null;

  const width = toFiniteNumber(firstMedia?.width) || toFiniteNumber(item?.width);
  const height = toFiniteNumber(firstMedia?.height) || toFiniteNumber(item?.height);

  const aspectRatio =
    toFiniteNumber(firstMedia?.aspectRatio) ||
    toFiniteNumber(firstMedia?.aspect_ratio) ||
    toFiniteNumber(item?.aspect_ratio) ||
    toFiniteNumber(item?.mediaAspectRatio) ||
    (width && height ? width / height : null) ||
    DEFAULT_CONTENT_ASPECT_RATIO;

  if (__DEV__) {
    console.log('[NEWS_MEDIA_DEBUG]', {
      id: item?.type_id || item?.id,
      hasMediaItems: Array.isArray(item?.mediaItems) && item.mediaItems.length > 0,
      raw_media_ar: firstMedia?.aspectRatio ?? firstMedia?.aspect_ratio ?? null,
      raw_ratio_key: firstMedia?.ratio_key ?? firstMedia?.ratioKey ?? null,
      raw_width: firstMedia?.width ?? null,
      raw_height: firstMedia?.height ?? null,
      parsed_aspectRatio: aspectRatio,
      sourceUri,
    });
  }

  return { sourceUri, aspectRatio };
};

const dedupeById = (items) => {
  const map = new Map();
  items.forEach((item) => {
    if (!item?.id) return;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

const formatStartAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const NewsScreen = ({ navigation }) => {
  const isWeb = Platform.OS === 'web';
  const { session } = useSession();
  const { strings, isRTL } = useLanguage();
  const newsStrings = strings.news;
  const menuStrings = strings.menu;
  const sidebarTitle = strings.home?.greeting || newsStrings.title;
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const itemsCountRef = useRef(0);

  const retryLabel = strings.travel?.retryLabel || 'Riprova';
  const loadingLabel = 'Caricamento contenuti...';
  const emptyLabel = 'Nessun contenuto disponibile al momento.';
  const errorLabel = 'Non siamo riusciti a caricare gli aggiornamenti.';

  const showSoftError = useCallback(
    (message) => {
      const text = message || errorLabel;
      if (Platform.OS === 'web') {
        console.warn('[news] request failed:', text);
        return;
      }
      Alert.alert(newsStrings.title, text);
    },
    [errorLabel, newsStrings.title],
  );

  const loadItems = useCallback(
    async ({ reset = false, silent = false } = {}) => {
      if (isLoadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;

      isLoadingRef.current = true;
      const nextOffset = reset ? 0 : offsetRef.current;
      const hasItems = itemsCountRef.current > 0;

      if (reset) {
        setRefreshing(hasItems);
        if (!hasItems) setInitialLoading(true);
      } else if (nextOffset > 0) {
        setLoadingMore(true);
      } else {
        setInitialLoading(true);
      }

      try {
        const response = await fetchEventsNews({
          limit: PAGE_SIZE,
          offset: nextOffset,
          accessToken: session?.access_token || null,
        });
        const incoming = Array.isArray(response?.items) ? response.items : [];
        const resolvedHasMore = incoming.length > 0 && Boolean(response?.hasMore);
        const resolvedNextOffset =
          typeof response?.nextOffset === 'number' ? response.nextOffset : nextOffset + incoming.length;

        setError(null);
        hasMoreRef.current = resolvedHasMore;
        offsetRef.current = resolvedNextOffset;

        if (reset) {
          const deduped = dedupeById(incoming);
          itemsCountRef.current = deduped.length;
          setItems(deduped);
        } else {
          setItems((prev) => {
            const merged = dedupeById([...prev, ...incoming]);
            itemsCountRef.current = merged.length;
            return merged;
          });
        }
      } catch (requestError) {
        setError(requestError);
        if (!silent) {
          showSoftError(requestError?.message);
        }
      } finally {
        isLoadingRef.current = false;
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [session?.access_token, showSoftError],
  );

  useEffect(() => {
    offsetRef.current = 0;
    hasMoreRef.current = true;
    itemsCountRef.current = 0;
    setItems([]);
    loadItems({ reset: true, silent: true });
  }, [loadItems]);

  const handleRefresh = useCallback(() => {
    offsetRef.current = 0;
    hasMoreRef.current = true;
    loadItems({ reset: true });
  }, [loadItems]);

  const handleEndReached = useCallback(() => {
    if (initialLoading || refreshing || loadingMore) return;
    if (!hasMoreRef.current) return;
    loadItems();
  }, [initialLoading, loadingMore, refreshing, loadItems]);

  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => {
      const isEvent = item.type === 'event';
      const eventMeta = isEvent
        ? [item.location, formatStartAt(item.starts_at)].filter(Boolean).join(' • ')
        : null;
      const badgeLabel = isEvent ? newsStrings.eventsSection : newsStrings.newsSection;
      const { sourceUri, aspectRatio } = getBestMedia(item);

      return (
        <View style={styles.newsCard}>
          {sourceUri ? (
            <ResponsiveMedia
              uri={sourceUri}
              aspectRatio={aspectRatio}
            />
          ) : null}
          <View style={styles.cardContent}>
            <View style={styles.badgeRow}>
              <Text style={[styles.typeBadge, isEvent ? styles.eventBadge : styles.newsBadge]}>{badgeLabel}</Text>
            </View>
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>{item.title}</Text>
            {item.excerpt ? <Text style={[styles.cardExcerpt, isRTL && styles.rtlText]}>{item.excerpt}</Text> : null}
            {isEvent && eventMeta ? <Text style={[styles.eventMeta, isRTL && styles.rtlText]}>{eventMeta}</Text> : null}
          </View>
        </View>
      );
    },
    [isRTL, newsStrings.eventsSection, newsStrings.newsSection],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, isRTL && styles.rtlText]}>{newsStrings.title}</Text>
        {error && items.length > 0 ? (
          <View style={styles.errorRow}>
            <Text style={[styles.errorText, isRTL && styles.rtlText]}>{errorLabel}</Text>
            <Pressable style={styles.retryButton} onPress={() => loadItems({ reset: true })}>
              <Text style={styles.retryButtonText}>{retryLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [error, errorLabel, isRTL, items.length, loadItems, newsStrings.title, retryLabel],
  );

  const listEmpty = useMemo(() => {
    if (initialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{loadingLabel}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{error ? errorLabel : emptyLabel}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadItems({ reset: true })}>
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </Pressable>
      </View>
    );
  }, [emptyLabel, error, errorLabel, initialLoading, isRTL, loadItems, loadingLabel, retryLabel]);

  const listFooter = useMemo(() => {
    if (!loadingMore) return <View style={styles.footerSpacer} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [loadingMore]);

  return (
    <ImageBackground
      source={backgroundImage}
      defaultSource={backgroundImage}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.overlay, isWeb && styles.overlayWeb]}>
          <View style={styles.container}>
            <FlatList
              data={items}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={listEmpty}
              ListFooterComponent={listFooter}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.35}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              contentContainerStyle={[styles.list, isWeb && styles.webList]}
              showsVerticalScrollIndicator={false}
            />
          </View>
          <WebSidebar
            title={sidebarTitle}
            menuStrings={menuStrings}
            navigation={navigation}
            isRTL={isRTL}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  overlayWeb: {
    paddingLeft: WEB_TAB_BAR_WIDTH,
  },
  backgroundImage: {
    resizeMode: 'cover',
    alignSelf: 'center',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  pageHeader: {
    marginBottom: theme.spacing.md,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.secondary,
    marginBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  webList: {
    paddingRight: theme.spacing.lg + WEB_SIDE_MENU_WIDTH,
    paddingLeft: theme.spacing.lg + WEB_TAB_BAR_WIDTH,
  },
  newsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  eventBadge: {
    color: '#8A1C09',
    backgroundColor: 'rgba(242, 163, 101, 0.25)',
  },
  newsBadge: {
    color: theme.colors.secondary,
    backgroundColor: 'rgba(231, 0, 19, 0.12)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardExcerpt: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.muted,
  },
  eventMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.secondary,
    marginTop: theme.spacing.xs,
  },
  errorRow: {
    backgroundColor: 'rgba(214, 69, 69, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214, 69, 69, 0.25)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    color: theme.colors.danger || '#d64545',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.text,
    opacity: 0.9,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
});

export default NewsScreen;

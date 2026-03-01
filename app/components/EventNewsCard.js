import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import ResponsiveMedia from './ResponsiveMedia';

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

  return {
    sourceUri,
    aspectRatio,
    hasMediaItems: Boolean(firstMedia),
    firstMedia,
  };
};

const formatStartsAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const EventNewsCard = ({ item, isRTL, onPress, accessibilityRole }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEvent = item?.type === 'event';
  const badgeLabel = isEvent ? 'Evento' : 'Notizia';
  const preview = item?.excerpt || item?.content || '';
  const eventMeta = isEvent ? [item?.location, formatStartsAt(item?.starts_at)].filter(Boolean).join(' • ') : '';
  const { sourceUri, aspectRatio, hasMediaItems, firstMedia } = useMemo(() => getBestMedia(item), [item]);

  useEffect(() => {
    if (!__DEV__) return;
    const type = String(item?.type || '').trim().toLowerCase();
    const kind = String(item?.kind || '').trim().toLowerCase();
    const isEventNewsLike =
      kind === 'event_news' ||
      kind === 'event' ||
      kind === 'news' ||
      type === 'event' ||
      type === 'news';
    if (!isEventNewsLike) return;

    console.log('[EVENT_NEWS_MEDIA_DEBUG]', {
      id: item?.type_id || item?.id,
      hasMediaItems: Array.isArray(item?.mediaItems) && item.mediaItems.length > 0,
      raw_media_ar: firstMedia?.aspectRatio ?? firstMedia?.aspect_ratio ?? null,
      raw_ratio_key: firstMedia?.ratio_key ?? firstMedia?.ratioKey ?? null,
      raw_width: firstMedia?.width ?? null,
      raw_height: firstMedia?.height ?? null,
      parsed_aspectRatio: aspectRatio,
      sourceUri,
    });
  }, [aspectRatio, firstMedia, hasMediaItems, item?.id, item?.kind, item?.mediaItems, item?.type, item?.type_id, sourceUri]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? accessibilityRole || 'button' : undefined}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      {sourceUri ? (
        <ResponsiveMedia
          uri={sourceUri}
          aspectRatio={aspectRatio}
        />
      ) : null}
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, isEvent ? styles.eventBadge : styles.newsBadge]}>{badgeLabel}</Text>
        </View>
        {item?.title ? <Text style={[styles.title, isRTL && styles.rtlText]}>{item.title}</Text> : null}
        {preview ? <Text style={[styles.preview, isRTL && styles.rtlText]}>{preview}</Text> : null}
        {eventMeta ? <Text style={[styles.meta, isRTL && styles.rtlText]}>{eventMeta}</Text> : null}
      </View>
    </Pressable>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    pressed: {
      opacity: 0.92,
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    badgeRow: {
      flexDirection: 'row',
      marginBottom: theme.spacing.xs,
    },
    badge: {
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
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    preview: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.muted,
    },
    meta: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.secondary,
      marginTop: theme.spacing.xs,
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });

export default EventNewsCard;

import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import ResponsiveMedia from './ResponsiveMedia';
import { getBestMediaInfo } from '../utils/media';

const DEFAULT_CONTENT_ASPECT_RATIO = 4 / 5;
const WEB_CARD_MIN_WIDTH = 440;
const WEB_CARD_MAX_WIDTH = 860;
const WEB_TARGET_MAX_MEDIA_WIDTH = 700;
const WEB_TARGET_MEDIA_VIEWPORT_SHARE = 0.5;
const WEB_MAX_MEDIA_HEIGHT_PX = 560;
const WEB_MAX_MEDIA_VH = 0.6;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatStartsAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const EventNewsCard = ({ item, isRTL, onPress, accessibilityRole, eventBadgeLabel, newsBadgeLabel }) => {
  const isWeb = Platform.OS === 'web';
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEvent = item?.type === 'event';
  const badgeLabel = isEvent ? eventBadgeLabel || 'Evento' : newsBadgeLabel || 'Notizia';
  const preview = item?.excerpt || item?.content || '';
  const eventMeta = isEvent ? [item?.location, formatStartsAt(item?.starts_at)].filter(Boolean).join(' • ') : '';
  const { uri: sourceUri, aspectRatio } = useMemo(
    () => getBestMediaInfo(item, DEFAULT_CONTENT_ASPECT_RATIO),
    [item],
  );
  const webSizing = useMemo(() => {
    if (!isWeb) return null;

    const safeAspectRatio = Number(aspectRatio) > 0 ? Number(aspectRatio) : DEFAULT_CONTENT_ASPECT_RATIO;
    const safeWindowWidth = Math.max(320, Number(windowWidth) || 320);
    const safeWindowHeight = Math.max(320, Number(windowHeight) || 320);
    const maxHeight = Math.min(WEB_MAX_MEDIA_HEIGHT_PX, safeWindowHeight * WEB_MAX_MEDIA_VH);
    const desiredMediaWidth = Math.min(WEB_TARGET_MAX_MEDIA_WIDTH, safeWindowWidth * WEB_TARGET_MEDIA_VIEWPORT_SHARE);
    const desiredMediaHeight = desiredMediaWidth / safeAspectRatio;
    const unclampedMediaWidth = desiredMediaHeight > maxHeight
      ? Math.max(1, Math.floor(maxHeight * safeAspectRatio))
      : Math.max(1, Math.floor(desiredMediaWidth));

    const maxCardWidth = Math.min(WEB_CARD_MAX_WIDTH, Math.max(280, safeWindowWidth - 48));
    const minCardWidth = Math.min(WEB_CARD_MIN_WIDTH, maxCardWidth);
    const cardWidth = clamp(unclampedMediaWidth, minCardWidth, maxCardWidth);
    const mediaWidth = Math.min(unclampedMediaWidth, cardWidth);

    return {
      cardWidth,
      minCardWidth,
      maxCardWidth,
      mediaWidth,
    };
  }, [aspectRatio, isWeb, windowHeight, windowWidth]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? accessibilityRole || 'button' : undefined}
      style={({ pressed }) => [
        styles.cardBase,
        isWeb
          ? [
              styles.cardWeb,
              {
                width: webSizing?.cardWidth,
                minWidth: webSizing?.minCardWidth,
                maxWidth: webSizing?.maxCardWidth,
              },
            ]
          : styles.cardMobile,
        pressed && onPress && styles.pressed,
      ]}
    >
      {sourceUri ? (
        <View style={styles.mediaSection}>
          <View style={[styles.mediaInner, isWeb && webSizing ? { width: webSizing.mediaWidth } : null]}>
            <ResponsiveMedia
              uri={sourceUri}
              aspectRatio={aspectRatio}
            />
          </View>
        </View>
      ) : null}
      <View style={styles.textSection}>
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
    cardBase: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    cardWeb: {
      alignSelf: 'center',
      maxWidth: '100%',
    },
    cardMobile: {
      width: '100%',
    },
    pressed: {
      opacity: 0.92,
    },
    mediaSection: {
      width: '100%',
      alignItems: 'center',
    },
    mediaInner: {
      width: '100%',
    },
    textSection: {
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

import React, { useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const DEFAULT_ASPECT_RATIO = 16 / 9;
const WEB_MAX_MEDIA_HEIGHT_PX = 520;
const WEB_MAX_MEDIA_VH = 0.6;
const WEB_MIN_MEDIA_HEIGHT_PX = 180;

const toFinitePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isDebugMedia = () => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug_media') === '1';
  } catch (_error) {
    return false;
  }
};
const DEBUG_MEDIA = isDebugMedia();

const formatDebugValue = (value, decimals = 2) => {
  if (value == null) return 'null';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return String(Number(num.toFixed(decimals)));
};

const ResponsiveMedia = ({ uri, aspectRatio, borderRadius = 0, debugInfo = null }) => {
  const { height: windowHeight } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const isWeb = Platform.OS === 'web';

  const safeAspectRatio = toFinitePositiveNumber(aspectRatio) || DEFAULT_ASPECT_RATIO;

  const sizing = useMemo(() => {
    if (!isWeb) {
      return {
        computedHeight: null,
        maxHeight: null,
        finalHeight: null,
      };
    }

    const safeWindowHeight = Math.max(320, Number(windowHeight) || 320);
    const maxHeight = Math.max(
      WEB_MIN_MEDIA_HEIGHT_PX,
      Math.min(WEB_MAX_MEDIA_HEIGHT_PX, safeWindowHeight * WEB_MAX_MEDIA_VH),
    );

    const computedHeight =
      containerWidth > 0 ? containerWidth / safeAspectRatio : maxHeight;
    const finalHeight = Math.min(computedHeight, maxHeight);

    return {
      computedHeight,
      maxHeight,
      finalHeight,
    };
  }, [containerWidth, isWeb, safeAspectRatio, windowHeight]);

  const wrapperStyle = useMemo(() => {
    if (!isWeb) {
      return {
        width: '100%',
        aspectRatio: safeAspectRatio,
        borderRadius,
      };
    }

    return {
      width: '100%',
      height: sizing.finalHeight,
      borderRadius,
    };
  }, [borderRadius, isWeb, safeAspectRatio, sizing.finalHeight]);

  if (!uri) return null;

  const computedHeight = sizing.computedHeight;
  const maxHeight = sizing.maxHeight;
  const finalHeight = isWeb ? sizing.finalHeight : containerWidth > 0 ? containerWidth / safeAspectRatio : null;
  const didClamp =
    isWeb &&
    Number.isFinite(computedHeight) &&
    Number.isFinite(maxHeight) &&
    computedHeight > maxHeight;
  const showDebugOverlay = DEBUG_MEDIA;

  return (
    <View
      style={[styles.wrapper, wrapperStyle]}
      onLayout={(event) => {
        const nextWidth = Math.max(1, event?.nativeEvent?.layout?.width || 0);
        setContainerWidth((prev) => (Math.abs(prev - nextWidth) < 0.5 ? prev : nextWidth));
      }}
    >
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      {showDebugOverlay ? (
        <View pointerEvents="none" style={styles.debugOverlay}>
          <Text style={styles.debugText}>id={debugInfo?.id ?? 'null'}</Text>
          <Text style={styles.debugText}>ratio_key={debugInfo?.ratio_key ?? 'null'}</Text>
          <Text style={styles.debugText}>raw_ar={formatDebugValue(debugInfo?.raw_media_ar)}</Text>
          <Text style={styles.debugText}>used_ar={formatDebugValue(debugInfo?.used_ar ?? safeAspectRatio)}</Text>
          <Text style={styles.debugText}>w={debugInfo?.raw_w ?? 'null'} h={debugInfo?.raw_h ?? 'null'}</Text>
          <Text style={styles.debugText}>
            cw={formatDebugValue(containerWidth)} ch={formatDebugValue(computedHeight)} maxH={formatDebugValue(isWeb ? maxHeight : null)}
          </Text>
          <Text style={styles.debugText}>finalH={formatDebugValue(finalHeight)} clamp={didClamp ? 'true' : 'false'}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    maxWidth: '90%',
  },
  debugText: {
    fontSize: 11,
    color: '#fff',
    lineHeight: 14,
  },
});

export default ResponsiveMedia;

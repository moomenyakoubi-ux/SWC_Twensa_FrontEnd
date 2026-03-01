import React, { useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

const DEFAULT_ASPECT_RATIO = 16 / 9;
const WEB_MAX_MEDIA_HEIGHT_PX = 560;
const WEB_MAX_MEDIA_VH = 0.6;

const toFinitePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const ResponsiveMedia = ({ uri, aspectRatio, borderRadius = 0 }) => {
  const { height: windowHeight } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const isWeb = Platform.OS === 'web';

  const safeAspectRatio = toFinitePositiveNumber(aspectRatio) || DEFAULT_ASPECT_RATIO;

  const sizing = useMemo(() => {
    if (!isWeb) {
      return {
        computedHeight: null,
        maxHeight: null,
        finalWidth: null,
        finalHeight: null,
      };
    }

    const safeWindowHeight = Math.max(320, Number(windowHeight) || 320);
    const maxHeight = Math.min(WEB_MAX_MEDIA_HEIGHT_PX, safeWindowHeight * WEB_MAX_MEDIA_VH);

    if (containerWidth <= 0) {
      return {
        computedHeight: null,
        maxHeight,
        finalWidth: null,
        finalHeight: maxHeight,
      };
    }

    const computedHeight = containerWidth / safeAspectRatio;
    const shouldClampHeight = computedHeight > maxHeight;
    const finalHeight = shouldClampHeight ? maxHeight : computedHeight;
    const finalWidth = shouldClampHeight
      ? Math.min(containerWidth, Math.max(1, Math.floor(maxHeight * safeAspectRatio)))
      : containerWidth;

    return {
      computedHeight,
      maxHeight,
      finalWidth,
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
      width: sizing.finalWidth ?? '100%',
      height: sizing.finalHeight ?? sizing.maxHeight,
      maxWidth: '100%',
      alignSelf: 'center',
      overflow: 'hidden',
      borderRadius,
    };
  }, [borderRadius, isWeb, safeAspectRatio, sizing.finalHeight, sizing.finalWidth, sizing.maxHeight]);

  if (!uri) return null;

  return (
    <View
      style={[styles.wrapper, wrapperStyle]}
      onLayout={(event) => {
        const rawWidth = Number(event?.nativeEvent?.layout?.width) || 0;
        const nextWidth = rawWidth > 0 ? rawWidth : 0;
        setContainerWidth((prev) => (Math.abs(prev - nextWidth) < 0.5 ? prev : nextWidth));
      }}
    >
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
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
});

export default ResponsiveMedia;

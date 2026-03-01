import React, { useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

const DEFAULT_ASPECT_RATIO = 16 / 9;
const WEB_MAX_MEDIA_HEIGHT_PX = 520;
const WEB_MAX_MEDIA_VH = 0.6;
const WEB_MIN_MEDIA_HEIGHT_PX = 180;

const toFinitePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const ResponsiveMedia = ({ uri, aspectRatio, borderRadius = 0 }) => {
  const { height: windowHeight } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const isWeb = Platform.OS === 'web';

  const safeAspectRatio = toFinitePositiveNumber(aspectRatio) || DEFAULT_ASPECT_RATIO;

  const wrapperStyle = useMemo(() => {
    if (!isWeb) {
      return {
        width: '100%',
        aspectRatio: safeAspectRatio,
        borderRadius,
      };
    }

    const safeWindowHeight = Math.max(320, Number(windowHeight) || 320);
    const maxHeight = Math.max(
      WEB_MIN_MEDIA_HEIGHT_PX,
      Math.min(WEB_MAX_MEDIA_HEIGHT_PX, safeWindowHeight * WEB_MAX_MEDIA_VH),
    );

    const computedHeight =
      containerWidth > 0 ? containerWidth / safeAspectRatio : maxHeight;
    const clampedHeight = Math.min(computedHeight, maxHeight);

    return {
      width: '100%',
      height: clampedHeight,
      borderRadius,
    };
  }, [borderRadius, containerWidth, isWeb, safeAspectRatio, windowHeight]);

  if (!uri) return null;

  return (
    <View
      style={[styles.wrapper, wrapperStyle]}
      onLayout={(event) => {
        const nextWidth = Math.max(1, event?.nativeEvent?.layout?.width || 0);
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

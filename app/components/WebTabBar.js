import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

const COLLAPSED_TAB_BAR_WIDTH = 88;
const EXPANDED_TAB_BAR_WIDTH = 244;
const ANIMATION_DURATION = 220;

export const WEB_TAB_BAR_WIDTH = COLLAPSED_TAB_BAR_WIDTH;

const getActiveRouteNameFromState = (state) => {
  if (!state?.routes?.length) return null;
  const currentRoute = state.routes[state.index ?? 0];
  if (!currentRoute) return null;
  if (currentRoute.state) return getActiveRouteNameFromState(currentRoute.state);
  return currentRoute.name ?? null;
};

const resolveCurrentRouteName = ({ state, navigation, navigationRef }) => {
  const navFromRef = navigationRef?.current ?? navigationRef;
  const fromRefRoute = navFromRef?.getCurrentRoute?.()?.name;
  if (fromRefRoute) return fromRefRoute;
  const fromState = getActiveRouteNameFromState(state);
  if (fromState) return fromState;
  const fromRefState = getActiveRouteNameFromState(navFromRef?.getState?.());
  if (fromRefState) return fromRefState;
  const fromNavigationState = getActiveRouteNameFromState(navigation?.getState?.());
  if (fromNavigationState) return fromNavigationState;
  return navigation?.getCurrentRoute?.()?.name ?? null;
};

const WebTabBar = ({ state, descriptors, navigation, navigationRef }) => {
  if (Platform.OS !== 'web') return null;

  const { theme: appTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const [isExpanded, setIsExpanded] = useState(false);
  const widthAnim = useRef(new Animated.Value(COLLAPSED_TAB_BAR_WIDTH)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const currentRouteName = useMemo(
    () => resolveCurrentRouteName({ state, navigation, navigationRef }),
    [state, navigation, navigationRef],
  );

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[WebTabBar] currentRouteName=', currentRouteName, 'tabs=', state?.routes?.map((r) => r.name));
  }, [currentRouteName, state]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: isExpanded ? EXPANDED_TAB_BAR_WIDTH : COLLAPSED_TAB_BAR_WIDTH,
        duration: ANIMATION_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(labelOpacity, {
        toValue: isExpanded ? 1 : 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded, labelOpacity, widthAnim]);

  const labelWidth = widthAnim.interpolate({
    inputRange: [COLLAPSED_TAB_BAR_WIDTH, EXPANDED_TAB_BAR_WIDTH],
    outputRange: [0, 136],
    extrapolate: 'clamp',
  });

  const labelGap = widthAnim.interpolate({
    inputRange: [COLLAPSED_TAB_BAR_WIDTH, EXPANDED_TAB_BAR_WIDTH],
    outputRange: [0, appTheme.spacing.md],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[styles.container, { width: widthAnim }]}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {state.routes.map((route) => {
        const { options } = descriptors[route.key];
        const isHidden =
          options?.tabBarStyle?.display === 'none' || options?.tabBarItemStyle?.display === 'none';

        if (isHidden) {
          return null;
        }

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;
        const labelText = typeof label === 'string' ? label : route.name;

        const isFocused = currentRouteName === route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={({ hovered, pressed }) => [
              styles.item,
              styles.itemWeb,
              isExpanded ? styles.itemExpanded : styles.itemCollapsed,
              isFocused && styles.itemActive,
              !isFocused && hovered && styles.itemHovered,
              !isFocused && hovered && styles.itemHoveredTransform,
              pressed && styles.itemPressed,
            ]}
          >
            {({ hovered }) => {
              const icon =
                typeof options.tabBarIcon === 'function'
                  ? options.tabBarIcon({
                      focused: isFocused,
                      size: 22,
                      color: isFocused
                        ? appTheme.colors.card
                        : hovered
                          ? appTheme.colors.primary
                          : appTheme.colors.secondary,
                    })
                  : null;

              return (
                <>
                  {icon}
                  <Animated.View
                    style={[styles.labelWrap, { width: labelWidth, marginLeft: labelGap, opacity: labelOpacity }]}
                  >
                    <Text
                      style={[
                        styles.label,
                        isFocused && styles.labelActive,
                        !isFocused && hovered && styles.labelHovered,
                      ]}
                      numberOfLines={1}
                    >
                      {labelText}
                    </Text>
                  </Animated.View>
                </>
              );
            }}
          </Pressable>
        );
      })}
    </Animated.View>
  );
};

const createStyles = (appTheme) =>
  StyleSheet.create({
    container: {
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      paddingVertical: appTheme.spacing.lg,
      paddingHorizontal: appTheme.spacing.sm,
      backgroundColor: appTheme.colors.card,
      borderRightWidth: 1,
      borderRightColor: appTheme.colors.divider,
      gap: appTheme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'flex-start',
      ...appTheme.shadow.card,
      zIndex: 30,
    },
    item: {
      width: '100%',
      paddingVertical: appTheme.spacing.sm,
      paddingHorizontal: appTheme.spacing.xs,
      borderRadius: appTheme.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
    },
    itemWeb: {
      transitionProperty: 'background-color, transform, opacity',
      transitionDuration: '200ms',
      transitionTimingFunction: 'ease-out',
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    itemCollapsed: {
      justifyContent: 'center',
    },
    itemExpanded: {
      justifyContent: 'flex-start',
    },
    itemActive: {
      backgroundColor: appTheme.colors.secondary,
    },
    itemHovered: {
      backgroundColor: 'rgba(231, 0, 19, 0.10)',
    },
    itemHoveredTransform: {
      transform: [{ scale: 1.03 }],
    },
    itemPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.92,
    },
    labelWrap: {
      overflow: 'hidden',
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: appTheme.colors.text,
      textAlign: 'left',
    },
    labelHovered: {
      color: appTheme.colors.primary,
    },
    labelActive: {
      color: appTheme.colors.card,
    },
  });

export default WebTabBar;

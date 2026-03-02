import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

export const WEB_SIDE_MENU_WIDTH = 380;
const MENU_ICON_SIZE = 22;
const twensaWordmark = require('../../assets/brand/twensa-wordmark.png');
const WORDMARK_ASPECT_RATIO = 468 / 133;

const getMenuItems = (menuStrings) => [
  { label: menuStrings.addContact, icon: 'person-add', route: 'AddContact' },
  { label: menuStrings.accountSettings, icon: 'settings', route: 'AccountSettings' },
  { label: menuStrings.language, icon: 'globe', route: 'Lingua' },
  { label: menuStrings.privacy, icon: 'shield-checkmark', route: 'PrivacyPolicy' },
  { label: menuStrings.terms, icon: 'document-text', route: 'Termini' },
  { label: menuStrings.copyright, icon: 'ribbon', route: 'Copyright' },
  { label: menuStrings.cookies, icon: 'ice-cream', route: 'CookiePolicy' },
  { label: menuStrings.aiUsage, icon: 'sparkles', route: 'AiUsage' },
  { label: menuStrings.support, icon: 'call', route: 'Support' },
];

const getActiveRouteNameFromState = (state) => {
  if (!state?.routes?.length) return null;
  const currentRoute = state.routes[state.index ?? 0];
  if (!currentRoute) return null;
  if (currentRoute.state) return getActiveRouteNameFromState(currentRoute.state);
  return currentRoute.name ?? null;
};

const resolveCurrentRouteName = (nav) => {
  if (!nav) return null;

  try {
    if (nav?.isReady?.()) {
      const directRoute = nav.getCurrentRoute?.();
      if (directRoute?.name) return directRoute.name;
    }
  } catch (_error) {
    // Ignore readiness timing errors and fallback to state traversal.
  }

  try {
    const rootState = nav?.getRootState?.();
    const routeFromRoot = getActiveRouteNameFromState(rootState);
    if (routeFromRoot) return routeFromRoot;
  } catch (_error) {
    // Ignore readiness timing errors and fallback to getState.
  }

  try {
    const state = nav?.getState?.();
    return getActiveRouteNameFromState(state);
  } catch (_error) {
    return null;
  }
};

const WebSidebar = ({ title, menuStrings, navigationRef, isRTL }) => {
  if (Platform.OS !== 'web') return null;

  const { theme: appTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const nav = navigationRef?.current ?? navigationRef;
  const [hoveredRoute, setHoveredRoute] = useState(null);
  const [activeRoute, setActiveRoute] = useState(() => resolveCurrentRouteName(nav));
  const [pendingRoute, setPendingRoute] = useState(null);

  const getCurrentRouteName = () => {
    const runtimeNav = navigationRef?.current ?? navigationRef;
    return resolveCurrentRouteName(runtimeNav);
  };

  const safeNavigate = (routeName) => {
    const runtimeNav = navigationRef?.current ?? navigationRef;
    if (!runtimeNav) {
      console.warn('[WebSidebar] navigation unavailable, queue:', routeName);
      return false;
    }

    try {
      if (runtimeNav?.isReady?.()) {
        runtimeNav.navigate(routeName);
        return true;
      }
      console.warn('[WebSidebar] navigation not ready, queue:', routeName);
      return false;
    } catch (_error) {
      console.warn('[WebSidebar] navigation failed, queue:', routeName);
      return false;
    }
  };

  useEffect(() => {
    let unsubscribeState;
    let unsubscribeFocus;
    let retryInterval = null;

    const syncActiveRoute = () => {
      setActiveRoute(getCurrentRouteName());
    };

    const attachListeners = () => {
      const runtimeNav = navigationRef?.current ?? navigationRef;
      syncActiveRoute();
      if (!runtimeNav?.addListener) return false;
      try {
        unsubscribeState = runtimeNav.addListener('state', syncActiveRoute);
        unsubscribeFocus = runtimeNav.addListener('focus', syncActiveRoute);
        return true;
      } catch (_error) {
        return false;
      }
    };

    const attachedNow = attachListeners();
    if (!attachedNow) {
      retryInterval = setInterval(() => {
        const attached = attachListeners();
        if (attached && retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
      }, 120);
    }

    return () => {
      if (retryInterval) clearInterval(retryInterval);
      if (typeof unsubscribeState === 'function') unsubscribeState();
      if (typeof unsubscribeFocus === 'function') unsubscribeFocus();
    };
  }, [navigationRef]);

  useEffect(() => {
    if (!pendingRoute) return undefined;
    const t = setInterval(() => {
      const runtimeNav = navigationRef?.current ?? navigationRef;
      try {
        if (runtimeNav?.isReady?.()) {
          runtimeNav.navigate(pendingRoute);
          setPendingRoute(null);
          clearInterval(t);
        }
      } catch (_error) {
        // Keep retrying until navigation is ready.
      }
    }, 50);
    return () => clearInterval(t);
  }, [navigationRef, pendingRoute]);

  return (
    <View style={[styles.sideMenu, isRTL && styles.sideMenuRtl, styles.sideMenuWeb]}>
      <Image
        source={twensaWordmark}
        style={[styles.menuTitleWordmark, isRTL && styles.menuTitleWordmarkRtl]}
        resizeMode="contain"
        accessibilityLabel={title}
      />
      <View style={styles.menuItems}>
        {getMenuItems(menuStrings).map((item) => {
          const isActive = activeRoute === item.route;
          const isHovered = hoveredRoute === item.route;
          const iconColor = isActive
            ? appTheme.colors.primary
            : isHovered
              ? appTheme.colors.secondary
              : appTheme.colors.muted;
          const labelColor = isActive
            ? appTheme.colors.primary
            : isHovered
              ? appTheme.colors.text
              : appTheme.colors.text;

          return (
            <TouchableOpacity
              key={item.route}
              style={[
                styles.menuItem,
                styles.menuItemWeb,
                isRTL && styles.menuItemRtl,
                isActive && styles.menuItemActive,
                !isActive && isHovered && styles.menuItemHover,
                isHovered && (isRTL ? styles.menuItemHoverShiftRtl : styles.menuItemHoverShift),
              ]}
              onMouseEnter={() => setHoveredRoute(item.route)}
              onMouseLeave={() => setHoveredRoute((current) => (current === item.route ? null : current))}
              onPress={() => {
                if (__DEV__) {
                  console.log('[WebSidebar] press', item.route, 'current(before)=', getCurrentRouteName());
                }
                const didNavigate = safeNavigate(item.route);
                if (!didNavigate) setPendingRoute(item.route);
                if (__DEV__) {
                  setTimeout(() => console.log('[WebSidebar] current(after)=', getCurrentRouteName()), 0);
                }
              }}
            >
              <Ionicons name={item.icon} size={22} color={iconColor} style={styles.menuIcon} />
              <Text style={[styles.menuLabel, isRTL && styles.rtlText, { color: labelColor }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (appTheme) =>
  StyleSheet.create({
    sideMenu: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: WEB_SIDE_MENU_WIDTH,
      paddingHorizontal: appTheme.spacing.md,
      paddingTop: appTheme.spacing.xl + appTheme.spacing.sm,
      backgroundColor: appTheme.colors.card,
      borderLeftWidth: 1,
      borderLeftColor: appTheme.colors.divider,
      ...appTheme.shadow.card,
      gap: appTheme.spacing.lg,
      alignItems: 'flex-start',
    },
    sideMenuWeb: {
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      height: '100vh',
      zIndex: 9999,
    },
    sideMenuRtl: {
      alignItems: 'flex-end',
    },
    menuTitleWordmark: {
      alignSelf: 'flex-start',
      height: 36,
      aspectRatio: WORDMARK_ASPECT_RATIO,
      marginLeft: 0,
      marginTop: Platform.OS === 'android' ? appTheme.spacing.sm : 0,
    },
    menuTitleWordmarkRtl: {
      alignSelf: 'flex-end',
      marginRight: 0,
      marginLeft: 0,
    },
    menuItems: {
      gap: appTheme.spacing.sm,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.md,
    },
    menuItemWeb: {
      minHeight: 44,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: 'transparent',
      transitionProperty: 'background-color, transform',
      transitionDuration: '200ms',
      transitionTimingFunction: 'ease-out',
    },
    menuItemHover: {
      backgroundColor: 'rgba(231, 0, 19, 0.08)',
    },
    menuItemActive: {
      backgroundColor: 'rgba(231, 0, 19, 0.14)',
    },
    menuItemHoverShift: {
      transform: [{ translateX: 2 }],
    },
    menuItemHoverShiftRtl: {
      transform: [{ translateX: -2 }],
    },
    menuItemRtl: {
      flexDirection: 'row-reverse',
    },
    menuIcon: {
      width: MENU_ICON_SIZE,
      textAlign: 'center',
      transitionProperty: 'color',
      transitionDuration: '200ms',
      transitionTimingFunction: 'ease-out',
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '600',
      transitionProperty: 'color',
      transitionDuration: '200ms',
      transitionTimingFunction: 'ease-out',
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });

export default WebSidebar;

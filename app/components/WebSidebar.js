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
  const directRoute = nav?.getCurrentRoute?.();
  if (directRoute?.name) return directRoute.name;
  const state = nav?.getState?.();
  return getActiveRouteNameFromState(state);
};

const WebSidebar = ({ title, menuStrings, navigationRef, isRTL }) => {
  if (Platform.OS !== 'web') return null;

  const { theme: appTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const nav = navigationRef?.current ?? navigationRef;
  const [hoveredRoute, setHoveredRoute] = useState(null);
  const [activeRoute, setActiveRoute] = useState(() => resolveCurrentRouteName(nav));

  useEffect(() => {
    let unsubscribeState;
    let retryTimer = null;
    let retries = 0;

    const getCurrentRouteName = () => {
      const runtimeNav = navigationRef?.current ?? navigationRef;
      return resolveCurrentRouteName(runtimeNav);
    };

    const syncActiveRoute = () => {
      setActiveRoute(getCurrentRouteName());
    };

    const attachListeners = () => {
      const runtimeNav = navigationRef?.current ?? navigationRef;
      syncActiveRoute();
      if (!runtimeNav?.addListener) {
        if (retries < 2) {
          retries += 1;
          retryTimer = setTimeout(attachListeners, 120);
        }
        return;
      }
      unsubscribeState = runtimeNav.addListener('state', syncActiveRoute);
    };

    attachListeners();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof unsubscribeState === 'function') unsubscribeState();
    };
  }, [navigationRef, nav]);

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
                const runtimeNav = navigationRef?.current ?? navigationRef;
                const getCurrentRouteName = () => resolveCurrentRouteName(navigationRef?.current ?? navigationRef);
                if (__DEV__) {
                  console.log('[WebSidebar] press', item.route, 'current(before)=', getCurrentRouteName());
                }
                if (runtimeNav?.isReady?.()) runtimeNav.navigate(item.route);
                else if (runtimeNav?.navigate) runtimeNav.navigate(item.route);
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

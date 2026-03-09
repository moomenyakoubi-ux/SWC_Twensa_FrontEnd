import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Navbar from '../components/Navbar';
import { signOut } from '../auth/authApi';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import { WEB_TAB_BAR_WIDTH } from '../components/WebTabBar';
import { WEB_SIDE_MENU_WIDTH } from '../components/WebSidebar';
import useSession from '../auth/useSession';
import useProfile from '../profile/useProfile';

const SettingRow = ({ icon, label, description, value, onToggle, isRTL, styles, appTheme }) => (
  <View style={[styles.settingRow, isRTL && styles.rowReverse]}>
    <View style={[styles.settingIcon, isRTL && styles.settingIconRtl]}>
      <Ionicons name={icon} size={20} color={appTheme.colors.secondary} />
    </View>
    <View style={styles.settingCopy}>
      <Text style={[styles.settingLabel, isRTL && styles.rtlText]}>{label}</Text>
      {description ? <Text style={[styles.settingDescription, isRTL && styles.rtlText]}>{description}</Text> : null}
    </View>
    <Switch
      trackColor={{ false: appTheme.colors.switchTrackOff, true: appTheme.colors.secondary }}
      thumbColor={value ? '#fff' : '#f4f3f4'}
      value={value}
      onValueChange={onToggle}
    />
  </View>
);

const AccountSettingsScreen = () => {
  const { strings, isRTL, language, setLanguage } = useLanguage();
  const { theme: appTheme, isDark, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const isWeb = Platform.OS === 'web';
  const menuStrings = strings.menu;
  const { language: languageStrings } = strings;
  const navigation = useNavigation();
  const { user } = useSession();
  const { profile, updateProfile, loading: profileLoading } = useProfile();
  const [notifications, setNotifications] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetCooldown, setPasswordResetCooldown] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const languageOptions = [
    { code: 'it', label: languageStrings.italian },
    { code: 'ar', label: languageStrings.arabic },
  ];

  const handleLanguageSelect = (code) => {
    setLanguage(code);
    setLanguageDropdownOpen(false);
  };

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile?.full_name]);

  const handleSaveFullName = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      Alert.alert('Errore', menuStrings.usernameEmptyError);
      return;
    }
    setSavingName(true);
    try {
      await updateProfile({ full_name: trimmed });
      Alert.alert('Successo', menuStrings.usernameUpdated);
    } catch (err) {
      Alert.alert('Errore', err?.message || menuStrings.usernameError);
    } finally {
      setSavingName(false);
    }
  };

  useEffect(() => {
    if (passwordResetCooldown <= 0) return undefined;
    const intervalId = setInterval(() => {
      setPasswordResetCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [passwordResetCooldown]);

  const buildResetRedirectUrl = () => {
    if (Platform.OS === 'web') {
      return `${window.location.origin}/auth/update-password`;
    }
    return Linking.createURL('auth/update-password');
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert('Errore', 'Email non disponibile.');
      return;
    }
    if (passwordResetCooldown > 0) {
      Alert.alert('Attendi', `Riprova tra ${passwordResetCooldown} secondi.`);
      return;
    }

    setPasswordResetLoading(true);
    const redirectTo = buildResetRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });

    if (error) {
      Alert.alert('Errore', error.message || 'Impossibile inviare il link.');
    } else {
      setShowPasswordModal(true);
      setPasswordResetCooldown(60);
    }
    setPasswordResetLoading(false);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      const options = isWeb ? { scope: 'local' } : undefined;
      const { error } = await signOut(options);
      if (error) {
        if (!isWeb) {
          Alert.alert('Errore', error.message);
        }
      }
      if (isWeb && typeof window !== 'undefined') {
        const storageKey = supabase?.auth?.storageKey;
        if (storageKey) {
          await AsyncStorage.removeItem(storageKey);
        }
        window.location.reload();
      }
    } catch (err) {
      Alert.alert('Errore', err?.message || 'Logout fallito.');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea]}>
      {!isWeb && (
        <Navbar
          title={menuStrings.accountSettings}
          isRTL={isRTL}
          onBack={() => navigation.navigate('Home')}
          backLabel={strings.tabs.home}
        />
      )}
      <ScrollView
        contentContainerStyle={[styles.content, isWeb && styles.webContent, isWeb && styles.webContentNoNav]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>Preferenze</Text>
          <SettingRow
            icon="notifications"
            label="Notifiche push"
            description="Aggiornamenti su chat, eventi e nuovi contatti."
            value={notifications}
            onToggle={() => setNotifications((prev) => !prev)}
            isRTL={isRTL}
            styles={styles}
            appTheme={appTheme}
          />
          <SettingRow
            icon="moon"
            label="Tema scuro"
            description="Riduci l'affaticamento visivo con toni soft."
            value={isDark}
            onToggle={toggleTheme}
            isRTL={isRTL}
            styles={styles}
            appTheme={appTheme}
          />
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{languageStrings.title}</Text>
          
          {/* Language Dropdown */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdownTrigger, isRTL && styles.rowReverse]}
              onPress={() => setLanguageDropdownOpen(!languageDropdownOpen)}
              activeOpacity={0.7}
            >
              <View style={[styles.dropdownTriggerContent, isRTL && styles.dropdownTriggerContentRtl]}>
                <Ionicons name="globe-outline" size={20} color={appTheme.colors.secondary} />
                <Text style={[styles.dropdownTriggerText, isRTL && styles.rtlText]}>
                  {language === 'it' ? languageStrings.italian : languageStrings.arabic}
                </Text>
              </View>
              <Ionicons 
                name={languageDropdownOpen ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={appTheme.colors.muted} 
              />
            </TouchableOpacity>
            
            {languageDropdownOpen && (
              <View style={[styles.dropdownMenu, isRTL && styles.dropdownMenuRtl]}>
                {languageOptions.map((option, index) => (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.dropdownItem,
                      index === 0 && styles.dropdownItemFirst,
                      index === languageOptions.length - 1 && styles.dropdownItemLast,
                      isRTL && styles.dropdownItemRtl,
                    ]}
                    onPress={() => handleLanguageSelect(option.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      isRTL && styles.rtlText,
                      option.code === language && styles.dropdownItemTextActive
                    ]}>
                      {option.label}
                    </Text>
                    {option.code === language && (
                      <Ionicons name="checkmark" size={18} color={appTheme.colors.secondary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          
          <Text style={[styles.helper, isRTL && styles.rtlText]}>
            {languageStrings.helper}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{menuStrings.userProfile}</Text>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{menuStrings.username}</Text>
            <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlText]}
                value={fullName}
                onChangeText={setFullName}
                placeholder={menuStrings.usernamePlaceholder}
                placeholderTextColor={appTheme.colors.muted}
                maxLength={100}
                editable={!profileLoading && !savingName}
              />
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (savingName || !fullName.trim() || fullName.trim() === profile?.full_name) && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveFullName}
                disabled={savingName || !fullName.trim() || fullName.trim() === profile?.full_name}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color={appTheme.colors.card} />
                ) : (
                  <Text style={styles.saveButtonText}>{menuStrings.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>Email</Text>
            <Text style={[styles.fieldValue, isRTL && styles.rtlText]}>{user?.email || '-'}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.actionRow, isRTL && styles.rowReverse]}
            onPress={handleChangePassword}
            disabled={passwordResetLoading || passwordResetCooldown > 0}
          >
            <Ionicons name="key" size={20} color={appTheme.colors.secondary} />
            <Text style={[styles.actionText, isRTL && styles.rtlText]}>
              {passwordResetLoading 
                ? menuStrings.sending 
                : passwordResetCooldown > 0 
                  ? `${menuStrings.retryIn || 'Riprova tra'} ${passwordResetCooldown}s`
                  : menuStrings.changePassword
              }
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionRow, isRTL && styles.rowReverse]}>
            <Ionicons name="shield-checkmark" size={20} color={appTheme.colors.secondary} />
            <Text style={[styles.actionText, isRTL && styles.rtlText]}>Verifica in due passaggi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutRow,
              isWeb && styles.logoutRowWeb,
              logoutLoading && styles.logoutDisabled,
              isRTL && styles.rowReverse,
            ]}
            onPress={handleLogout}
            disabled={logoutLoading}
          >
            <Ionicons name="log-out-outline" size={20} color={appTheme.colors.card} />
            <Text style={[styles.logoutText, isWeb && styles.logoutTextWeb, isRTL && styles.rtlText]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>Dati e privacy</Text>
          <TouchableOpacity style={[styles.actionRow, isRTL && styles.rowReverse]}>
            <Ionicons name="trash" size={20} color={appTheme.colors.secondary} />
            <Text style={[styles.actionText, isRTL && styles.rtlText]}>Elimina account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Password Reset Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPasswordModal}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isRTL && styles.rtlText]}>
            <View style={styles.modalIconContainer}>
              <View style={[styles.modalIconCircle, { backgroundColor: appTheme.colors.secondary }]}>
                <Ionicons name="mail" size={40} color="#fff" />
              </View>
            </View>
            
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {menuStrings.passwordResetTitle || 'Email inviata!'}
            </Text>
            
            <Text style={[styles.modalDescription, isRTL && styles.rtlText]}>
              {menuStrings.passwordResetSent}
            </Text>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: appTheme.colors.secondary }]}
              onPress={() => setShowPasswordModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>
                {menuStrings.gotIt || 'Ho capito'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (appTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: appTheme.colors.background,
    },
    webSafeArea: {
      paddingLeft: WEB_TAB_BAR_WIDTH,
    },
    content: {
      padding: appTheme.spacing.lg,
      gap: appTheme.spacing.md,
    },
    webContent: {
      paddingLeft: appTheme.spacing.xl,
      paddingRight: appTheme.spacing.xl + WEB_SIDE_MENU_WIDTH,
      width: '100%',
      maxWidth: 1100,
      alignSelf: 'center',
    },
    webContentNoNav: {
      paddingTop: 80, // Space for hamburger button
    },
    card: {
      backgroundColor: appTheme.colors.card,
      borderRadius: appTheme.radius.lg,
      padding: appTheme.spacing.lg,
      gap: appTheme.spacing.md,
      borderWidth: 1,
      borderColor: appTheme.colors.border,
      ...appTheme.shadow.card,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: appTheme.colors.text,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.md,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: appTheme.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingCopy: {
      flex: 1,
      gap: 4,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: appTheme.colors.text,
    },
    settingDescription: {
      color: appTheme.colors.muted,
    },
    fieldRow: {
      gap: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.sm,
      marginTop: appTheme.spacing.xs,
    },
    textInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: appTheme.colors.border,
      borderRadius: appTheme.radius.md,
      paddingHorizontal: appTheme.spacing.md,
      paddingVertical: 10,
      fontSize: 16,
      color: appTheme.colors.text,
      backgroundColor: appTheme.colors.background,
    },
    saveButton: {
      backgroundColor: appTheme.colors.secondary,
      paddingHorizontal: appTheme.spacing.md,
      paddingVertical: 10,
      borderRadius: appTheme.radius.md,
      minWidth: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: appTheme.colors.card,
      fontWeight: '700',
      fontSize: 14,
    },
    fieldLabel: {
      color: appTheme.colors.muted,
      fontWeight: '700',
    },
    fieldValue: {
      color: appTheme.colors.text,
      fontWeight: '600',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.sm,
      paddingVertical: 4,
    },
    actionText: {
      color: appTheme.colors.secondary,
      fontWeight: '600',
    },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: appTheme.spacing.lg,
      borderRadius: appTheme.radius.md,
      backgroundColor: appTheme.colors.primary,
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    logoutRowWeb: {
      backgroundColor: appTheme.colors.primary,
      borderWidth: 0,
      borderColor: 'transparent',
      boxShadow: '0 10px 24px rgba(215,35,35,0.2)',
      cursor: 'pointer',
      minWidth: 160,
      maxWidth: 200,
    },
    logoutText: {
      color: appTheme.colors.card,
      fontWeight: '700',
    },
    logoutTextWeb: {
      color: appTheme.colors.card,
      fontSize: 16,
      letterSpacing: 0.4,
    },
    logoutDisabled: {
      opacity: 0.7,
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    settingIconRtl: {
      transform: [{ scaleX: -1 }],
    },
    dropdownContainer: {
      position: 'relative',
      zIndex: 10,
    },
    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: appTheme.spacing.md,
      paddingVertical: 12,
      borderRadius: appTheme.radius.md,
      borderWidth: 1,
      borderColor: appTheme.colors.border,
      backgroundColor: appTheme.colors.background,
    },
    dropdownTriggerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: appTheme.spacing.sm,
    },
    dropdownTriggerContentRtl: {
      flexDirection: 'row-reverse',
    },
    dropdownTriggerText: {
      fontSize: 16,
      fontWeight: '600',
      color: appTheme.colors.text,
    },
    dropdownMenu: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: appTheme.colors.card,
      borderRadius: appTheme.radius.md,
      borderWidth: 1,
      borderColor: appTheme.colors.border,
      ...appTheme.shadow.card,
      zIndex: 100,
    },
    dropdownMenuRtl: {
      left: 0,
      right: 0,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: appTheme.spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: appTheme.colors.border,
    },
    dropdownItemRtl: {
      flexDirection: 'row-reverse',
    },
    dropdownItemFirst: {
      borderTopLeftRadius: appTheme.radius.md,
      borderTopRightRadius: appTheme.radius.md,
    },
    dropdownItemLast: {
      borderBottomWidth: 0,
      borderBottomLeftRadius: appTheme.radius.md,
      borderBottomRightRadius: appTheme.radius.md,
    },
    dropdownItemText: {
      fontSize: 15,
      fontWeight: '600',
      color: appTheme.colors.text,
    },
    dropdownItemTextActive: {
      color: appTheme.colors.secondary,
    },
    helper: {
      marginTop: appTheme.spacing.sm,
      fontSize: 13,
      color: appTheme.colors.muted,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(12, 27, 51, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: appTheme.spacing.lg,
    },
    modalContent: {
      backgroundColor: appTheme.colors.card,
      borderRadius: appTheme.radius.lg,
      padding: appTheme.spacing.xl,
      width: '100%',
      maxWidth: 360,
      alignItems: 'center',
      ...appTheme.shadow.card,
      borderWidth: 1,
      borderColor: appTheme.colors.border,
    },
    modalIconContainer: {
      marginBottom: appTheme.spacing.md,
    },
    modalIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      ...appTheme.shadow.card,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: appTheme.colors.text,
      marginBottom: appTheme.spacing.sm,
      textAlign: 'center',
    },
    modalDescription: {
      fontSize: 15,
      color: appTheme.colors.muted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: appTheme.spacing.lg,
    },
    modalButton: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: appTheme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });

export default AccountSettingsScreen;

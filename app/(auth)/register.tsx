// Register Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { COLORS, SPACING, BORDER_RADIUS, ERROR_MESSAGES, PATTERNS } from '@/utils/constants';
import { shadow } from '@/utils/shadows';
import { getFirebaseErrorMessage } from '@/utils/firebaseErrors';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error: authError, clearError } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!displayName.trim()) {
      newErrors.displayName = ERROR_MESSAGES.generic.required;
    } else if (!PATTERNS.displayName.test(displayName)) {
      newErrors.displayName = 'Name must be 2-30 characters';
    }

    if (!email.trim()) {
      newErrors.email = ERROR_MESSAGES.generic.required;
    } else if (!PATTERNS.email.test(email)) {
      newErrors.email = ERROR_MESSAGES.generic.invalidEmail;
    }

    if (!password) {
      newErrors.password = ERROR_MESSAGES.generic.required;
    } else if (!PATTERNS.password.test(password)) {
      newErrors.password = ERROR_MESSAGES.generic.passwordTooShort;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = ERROR_MESSAGES.generic.required;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = ERROR_MESSAGES.generic.namesDontMatch;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    clearError();
    setLoading(true);

    try {
      await register(email.trim(), password, displayName.trim());
      router.replace('/(tabs)/chats');
    } catch (err: unknown) {
      Alert.alert(
        'Registration Error',
        getFirebaseErrorMessage(err, 'Registration failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Title */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <LucideIcon name="message-circle" size={60} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join ChatApp and start connecting</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Display Name"
            placeholder="John Doe"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
            error={errors.displayName}
            returnKeyType="next"
            leftIcon={<LucideIcon name="user" size={20} color={COLORS.textTertiary} />}
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            returnKeyType="next"
            leftIcon={<LucideIcon name="mail" size={20} color={COLORS.textTertiary} />}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.password}
            returnKeyType="next"
            leftIcon={<LucideIcon name="lock" size={20} color={COLORS.textTertiary} />}
          />

          <Input
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.confirmPassword}
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            leftIcon={<LucideIcon name="lock" size={20} color={COLORS.textTertiary} />}
          />

          {/* Error Display */}
          {authError && (
            <View style={styles.errorBanner}>
              <LucideIcon name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          )}

          {/* Register Button */}
          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.registerButton}
          />
        </View>

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          By creating an account, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow({ color: COLORS.primary, offset: { width: 0, height: 4 }, opacity: 0.2, radius: 8, elevation: 8 }),
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  form: {
    width: '100%',
    gap: SPACING.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  errorBannerText: {
    fontSize: 14,
    color: COLORS.danger,
    flex: 1,
  },
  registerButton: {
    marginTop: SPACING.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  termsText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});
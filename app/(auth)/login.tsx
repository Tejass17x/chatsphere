// Login Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { getFirebaseErrorMessage } from '@/utils/firebaseErrors';

export default function LoginScreen() {
  const router = useRouter();
  const { login, resetPassword, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = ERROR_MESSAGES.generic.required;
    } else if (!PATTERNS.email.test(email)) {
      newErrors.email = ERROR_MESSAGES.generic.invalidEmail;
    }

    if (!password) {
      newErrors.password = ERROR_MESSAGES.generic.required;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    clearError();
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/chats');
    } catch (err: unknown) {
      Alert.alert(
        'Login Error',
        getFirebaseErrorMessage(err, 'Login failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim() || !PATTERNS.email.test(email)) {
      Alert.alert('Reset Password', 'Please enter a valid email address first.');
      return;
    }
    resetPassword(email.trim())
      .then(() => Alert.alert('Reset Password', 'Password reset email sent.'))
      .catch((error: unknown) => {
        Alert.alert(
          'Reset Password',
          getFirebaseErrorMessage(error, 'Unable to send a password reset email. Please try again.')
        );
      });
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
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="ChatSphere logo"
          />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue to ChatSphere</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
            autoComplete="password"
            error={errors.password}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            leftIcon={<LucideIcon name="lock" size={20} color={COLORS.textTertiary} />}
          />

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Error Display */}
          {authError && (
            <View style={styles.errorBanner}>
              <LucideIcon name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          )}

          {/* Login Button */}
          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.loginButton}
          />
        </View>

        {/* Register Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
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
  logo: {
    width: '100%',
    maxWidth: 280,
    height: 196,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -SPACING.xs,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
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
  loginButton: {
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
});
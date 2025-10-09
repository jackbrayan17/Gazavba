import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { ThemeCtx } from '../_layout';

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validatePhone(phone: string) {
  // very permissive: 7–15 digits (you can swap with a stricter CM pattern if you want)
  return /^[0-9+\s()-]{7,20}$/.test(phone.trim());
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const t = useContext(ThemeCtx);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return !!name && !!email && !!phone && !!password && validateEmail(email) && validatePhone(phone) && password.length >= 6;
  }, [name, email, phone, password]);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!validatePhone(phone)) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password should be at least 6 characters.');
      return;
    }

    try {
      setSubmitting(true);
      // Your AuthContext.register handles both cases:
      // - backend returns { user, token } on /auth/register
      // - OR it falls back to /auth/login with same credentials
      const result = await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
      if (result.success) {
        // Go straight to tabs (or to a profile setup screen if you have one)
        router.replace('/(tabs)/ChatListScreen');
      } else {
        Alert.alert('Registration Failed', result.error ?? 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.primary }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: t.subtext }]}>Join Gazavba today</Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputContainer, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <Ionicons name="person" size={20} color={t.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Full Name"
                placeholderTextColor={t.subtext}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <Ionicons name="mail" size={20} color={t.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Email"
                placeholderTextColor={t.subtext}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <Ionicons name="call" size={20} color={t.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Phone Number"
                placeholderTextColor={t.subtext}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <Ionicons name="lock-closed" size={20} color={t.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Password"
                placeholderTextColor={t.subtext}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: canSubmit ? t.primary : t.hairline }]}
              onPress={handleRegister}
              disabled={submitting || !canSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.registerButtonText}>
                {submitting ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
              <Text style={[styles.loginText, { color: t.subtext }]}>
                Already have an account? <Text style={{ color: t.primary }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16 },
  form: { width: '100%' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16 },
  registerButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { fontSize: 14 },
});

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { ThemeCtx } from '../_layout';

const logo = require('../../assets/images/logo.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const t = useContext(ThemeCtx);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidPhone = (value: string) => /^[0-9+\s()-]{7,20}$/.test(value.trim());

  const handleLogin = async () => {
    console.log('[LoginScreen] login button pressed', {
      hasPhone: Boolean(phone?.trim()),
      phoneLength: phone?.length || 0,
    });
    if (!phone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    const result = await login({ phone, password });
    setLoading(false);

    if (result.success) {
      console.log('[LoginScreen] login success navigating to chats');
      router.replace('/(tabs)/ChatListScreen');
    } else {
      console.warn('[LoginScreen] login failed', result.error);
      Alert.alert('Login Failed', result.error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={logo} style={{ width: 88, height: 88, marginBottom: 20 }} resizeMode="contain" />
          <Text style={[styles.title, { color: t.primary }]}>Welcome to Gazavba</Text>
          <Text style={[styles.subtitle, { color: t.subtext }]}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputContainer, { backgroundColor: t.card, borderColor: t.hairline }]}>
            <Ionicons name="call" size={20} color={t.subtext} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: t.text }]}
              placeholder="Phone Number"
              placeholderTextColor={t.subtext}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
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
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: t.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/auth/RegisterScreen')}
          >
            <Text style={[styles.registerText, { color: t.subtext }]}>
              Don&apos;t have an account? <Text style={{ color: t.primary }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  loginButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
  },
});
#!/usr/bin/env node
/* eslint-disable no-console */
const { io } = require('socket.io-client');

const trimTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value);

const DEFAULT_API_URL = 'https://gazavba.eeuez.com/api';
const DEFAULT_SOCKET_URL = 'https://gazavba.eeuez.com';

const apiBase = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL || process.env.GAZAVBA_API_URL || DEFAULT_API_URL
);
const socketBase = trimTrailingSlash(
  process.env.EXPO_PUBLIC_SOCKET_URL || process.env.GAZAVBA_SOCKET_URL || DEFAULT_SOCKET_URL
);

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

async function testHealth() {
  const url = `${apiBase}/health`;
  console.log(`→ Checking REST health at ${url}`);
  const result = await fetchJson(url, { method: 'GET' });
  console.log('✔ Health response', result);
  return result;
}

async function testLogin() {
  const phone = 699999999;
  const password = 'brayan8003';
  if (!phone || !password) {
    console.log('↷ Skipping login test (set GAZAVBA_TEST_PHONE & GAZAVBA_TEST_PASSWORD to enable)');
    return null;
  }
  const url = `${apiBase}/auth/login`;
  console.log(`→ Attempting login at ${url}`);
  const result = await fetchJson(url, {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  console.log('✔ Login succeeded for user', {
    userId: result?.user?.id,
    name: result?.user?.name,
  });
  return result;
}

async function testSocket(token, userId) {
  console.log(`→ Connecting to Socket.IO at ${socketBase}`);
  return new Promise((resolve, reject) => {
    const socket = io(socketBase, {
      auth: { token },
      transports: ['websocket'],
      timeout: 5000,
    });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.disconnect();
    };

    socket.on('connect', () => {
      console.log('✔ Socket connected, id=', socket.id);
      socket.emit('join', userId || 'diagnostics');
      cleanup();
      resolve(true);
    });

    socket.on('connect_error', (err) => {
      console.error('✖ Socket connection error', err?.message || err);
      cleanup();
      reject(err);
    });

    socket.on('error', (err) => {
      console.error('✖ Socket error', err?.message || err);
      cleanup();
      reject(err);
    });
  });
}

async function main() {
  console.log('Gazavba backend diagnostics');
  console.log('API base  :', apiBase);
  console.log('Socket base:', socketBase);

  try {
    await testHealth();
  } catch (error) {
    console.error('✖ Health check failed', error.message, error.payload || '');
    process.exitCode = 1;
    return;
  }

  let authResult = null;
  try {
    authResult = await testLogin();
  } catch (error) {
    console.error('✖ Login test failed', error.message, error.payload || '');
    process.exitCode = 1;
    return;
  }

  const token = authResult?.token;
  const userId = authResult?.user?.id;

  if (token && userId) {
    try {
      await testSocket(token, userId);
    } catch (error) {
      console.error('✖ Socket test failed', error.message || error);
      process.exitCode = 1;
      return;
    }
  } else {
    console.log('↷ Skipping socket test (no token from login test)');
  }

  console.log('All diagnostics completed successfully.');
}

main().catch((error) => {
  console.error('Unexpected diagnostics error', error);
  process.exitCode = 1;
});

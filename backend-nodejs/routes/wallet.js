/* eslint-env node */
const express = require('express');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/auth');

const router = express.Router();

const EEUEZ_BASE_URL = process.env.EEUEZ_BASE_URL || 'https://eeuez.com';
const EEUEZ_WALLET_PATH = process.env.EEUEZ_WALLET_PATH || '/wallet';
const EEUEZ_API_KEY = process.env.EEUEZ_API_KEY || 'i7p{/_AxH@Kvv654~?op7[U&#vDohbhI';
const EEUEZ_API_SECRET = process.env.EEUEZ_API_SECRET || 'RGzKSt)59(?(B=@HP1eQcJ{}jP)I_H)_';
const EEUEZ_PLATFORM_CODE = process.env.EEUEZ_PLATFORM_CODE || '';
const EEUEZ_RETURN_URL = process.env.EEUEZ_RETURN_URL || '';

/* ==================== AUTH ==================== */
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = decoded.userId || decoded.id;
    if (!req.userId) return res.status(403).json({ error: 'Invalid token payload' });
    next();
  });
};

const requestJson = (url, body, headers) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      ...headers,
    },
  };

  const req = transport.request(options, (res) => {
    let raw = '';
    res.on('data', (chunk) => {
      raw += chunk;
    });
    res.on('end', () => {
      const text = raw.trim();
      if (!text) {
        return resolve({ statusCode: res.statusCode || 500, body: {} });
      }
      try {
        const parsed = JSON.parse(text);
        resolve({ statusCode: res.statusCode || 500, body: parsed });
      } catch (error) {
        resolve({ statusCode: res.statusCode || 500, body: { raw: text } });
      }
    });
  });

  req.on('error', reject);
  req.write(data);
  req.end();
});

/**
 * POST /api/wallet - Fetch wallet status for the current user
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!EEUEZ_API_KEY || !EEUEZ_API_SECRET) {
      console.warn('[wallet] missing EEUEZ credentials', {
        hasKey: !!EEUEZ_API_KEY,
        hasSecret: !!EEUEZ_API_SECRET,
      });
      return res.status(200).json({
        wallet_exists: false,
        error: 'EEUEZ API not configured',
      });
    }

    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const action = (req.body.action || 'dashboard').toString();
    const allowed = new Set(['dashboard', 'deposit', 'withdraw', 'transfer']);
    if (!allowed.has(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const identifierType = user.email ? 'email' : 'id';
    const userIdentifier = user.email || user.id;

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(12).toString('hex');
    const platformCode = (req.body.platform_code || EEUEZ_PLATFORM_CODE || '').toString();
    const returnUrl = (req.body.return_url || EEUEZ_RETURN_URL || '').toString();

    const signaturePayload = [
      userIdentifier,
      identifierType,
      platformCode,
      action,
      timestamp,
      nonce,
    ].join('|');
    const signature = crypto
      .createHmac('sha256', EEUEZ_API_SECRET)
      .update(signaturePayload)
      .digest('hex');

    const payload = {
      user_identifier: userIdentifier,
      identifier_type: identifierType,
      action,
      timestamp,
      nonce,
    };
    if (platformCode) payload.platform_code = platformCode;
    if (returnUrl) payload.return_url = returnUrl;

    const url = new URL(EEUEZ_WALLET_PATH, EEUEZ_BASE_URL);
    console.log('[wallet] eeuez request', {
      userId: req.userId,
      identifierType,
      action,
      baseUrl: EEUEZ_BASE_URL,
      path: EEUEZ_WALLET_PATH,
      platformCode,
      hasReturnUrl: !!returnUrl,
    });
    const response = await requestJson(url, payload, {
      'X-EEUEZ-KEY': EEUEZ_API_KEY,
      'X-EEUEZ-SIGNATURE': signature,
    });

    console.log('[wallet] eeuez response', {
      statusCode: response.statusCode,
      walletExists: response.body?.wallet_exists,
      walletStatus: response.body?.wallet_status,
    });
    if (response.statusCode >= 400) {
      console.error('[wallet] eeuez error', {
        statusCode: response.statusCode,
        body: response.body,
      });
      return res.status(200).json({
        wallet_exists: false,
        error: 'Wallet request failed',
        statusCode: response.statusCode,
      });
    }

    res.status(200).json(response.body);
  } catch (error) {
    console.error('[wallet] POST / error:', error);
    res.status(200).json({
      wallet_exists: false,
      error: 'Failed to fetch wallet',
    });
  }
});

module.exports = router;

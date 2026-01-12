/* eslint-env node */
const jwt = require('jsonwebtoken');
const { cache } = require('../config/cache');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
try {
  const authConfig = require('../config/auth');
  Object.assign(module.exports, authConfig);
} catch (_) {}

/**
 * authenticateToken: Vérifie access token
 * Si expiré → tente refresh via header x-refresh-token
 */
const authenticateToken = async (req, res, next) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name !== 'TokenExpiredError' || !refreshToken) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Tentative de refresh
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      const valid = await cache.get(`refresh_token:${decoded.userId}`);
      if (valid !== refreshToken) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const newAccessToken = jwt.sign(
        { userId: decoded.userId },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      req.userId = decoded.userId;
      req.newAccessToken = newAccessToken;
      next();
    } catch {
      return res.status(403).json({ error: 'Refresh failed' });
    }
  }
};

module.exports = { authenticateToken };
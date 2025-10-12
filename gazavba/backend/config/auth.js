const DEFAULT_SECRET = 'gazavba_dev_secret_change_me';

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

if (!process.env.JWT_SECRET) {
  console.warn('[Auth] JWT_SECRET not set. Falling back to development secret. Set JWT_SECRET in your .env file for production.');
}

module.exports = { JWT_SECRET };

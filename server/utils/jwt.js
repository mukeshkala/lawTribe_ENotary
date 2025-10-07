// server/utils/jwt.js
const { createHash } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';

/**
 * Signs a payload into a simple JWT token.
 * @param {Object} payload - The data to include in the token.
 * @param {number} expiresInSeconds - Expiration time in seconds.
 * @returns {string} Signed JWT token
 */
function signJwt(payload, expiresInSeconds = 300) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = createHash('sha256')
    .update(`${header}.${body}${JWT_SECRET}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a JWT token and returns the decoded payload if valid.
 * @param {string} token - The JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyJwt(token) {
  if (!token) return null;
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) return null;

  const check = createHash('sha256')
    .update(`${header}.${body}${JWT_SECRET}`)
    .digest('base64url');

  if (check !== signature) return null;

  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
  if (decoded.exp * 1000 < Date.now()) return null;

  return decoded;
}

module.exports = { signJwt, verifyJwt };

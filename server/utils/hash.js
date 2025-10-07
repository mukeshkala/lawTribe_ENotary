const crypto = require('crypto');
const { JWT_SECRET } = require('../config');

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signJwt(payload, expiresInSeconds = 300) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHash('sha256').update(`${header}.${body}${JWT_SECRET}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  if (!token) return null;
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) return null;
  const check = crypto.createHash('sha256').update(`${header}.${body}${JWT_SECRET}`).digest('base64url');
  if (check !== signature) return null;
  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
  if (decoded.exp * 1000 < Date.now()) return null;
  return decoded;
}

module.exports = { hash, signJwt, verifyJwt };

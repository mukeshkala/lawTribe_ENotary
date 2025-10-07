const fs = require('fs');
const path = require('path');
const { DATA_DIR, UPLOAD_DIR, CERT_DIR } = require('../config');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

const sessionsFile = path.join(DATA_DIR, 'sessions.json');

function readSessions() {
  if (!fs.existsSync(sessionsFile)) return {};
  try {
    const data = fs.readFileSync(sessionsFile, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read sessions', err);
    return {};
  }
}

function writeSessions(sessions) {
  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
}

function saveUpload(fileName, base64) {
  const uploadId = crypto.randomUUID();
  const filePath = path.join(UPLOAD_DIR, `${uploadId}.pdf`);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  const previewPath = path.join(UPLOAD_DIR, `${uploadId}.preview.txt`);
  fs.writeFileSync(previewPath, `Preview unavailable: ${fileName}`);
  return { uploadId, fileName, storedAt: `/uploads/${uploadId}.pdf`, preview: `/api/uploads/${uploadId}/preview` };
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local[0] + '***' + local.slice(-1);
  const parts = domain.split('.');
  const maskedDomain = parts.map((part, i) => (i === 0 ? part[0] + '***' : part)).join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

function maskAadhaar(aadhaar) {
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

module.exports = { readSessions, writeSessions, saveUpload, maskEmail, maskAadhaar };

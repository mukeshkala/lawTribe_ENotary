const { hash } = require('../utils/hash');
const { DEMO_PROTEAN_OTP, OTP_TTL_MS, OTP_MAX_ATTEMPTS } = require('../config');
const { appendAudit } = require('./audit');
const { persistSessions, sessions } = require('./sessions');
const { nowISO, sendJson } = require('../serverHelpers');

function generateOtp() {
  return DEMO_PROTEAN_OTP;
}

async function sendOtp(req, res, sessionId, participantId) {
  const session = sessions.get(sessionId);
  if (!session) return sendJson(res, 404, { error: 'Session not found' });
  const participant = session.participants.find(p => p.id === participantId);
  if (!participant) return sendJson(res, 404, { error: 'Participant not found' });
  if (participant.otp.locked) return sendJson(res, 423, { error: 'OTP locked. Contact support.' });

  const otp = generateOtp();
  participant.otp.hash = hash(otp);
  participant.otp.expiresAt = Date.now() + OTP_TTL_MS;
  participant.otp.attempts = 0;
  participant.otp.lastSentAt = nowISO();

  appendAudit(session, 'OTP_SENT', { participantId, emailMasked: participant.email });
  persistSessions();
  sendJson(res, 200, { message: 'OTP dispatched', expiresAt: participant.otp.expiresAt });
}

async function verifyOtp(req, res, sessionId, participantId) {
  const session = sessions.get(sessionId);
  if (!session) return sendJson(res, 404, { error: 'Session not found' });
  const participant = session.participants.find(p => p.id === participantId);
  if (!participant) return sendJson(res, 404, { error: 'Participant not found' });
  if (participant.otp.locked) return sendJson(res, 423, { error: 'OTP locked. Contact support.' });

  try {
    const body = await require('../serverHelpers').parseBody(req);
    const code = body?.code;
    if (!code) return sendJson(res, 400, { error: 'OTP required' });
    if (!participant.otp.hash || !participant.otp.expiresAt) return sendJson(res, 400, { error: 'OTP not generated' });
    if (participant.otp.expiresAt < Date.now()) {
      participant.otp.hash = null;
      participant.otp.expiresAt = null;
      participant.otp.attempts = 0;
      appendAudit(session, 'OTP_EXPIRED', { participantId });
      persistSessions();
      return sendJson(res, 410, { error: 'OTP expired' });
    }

    participant.otp.attempts++;
    if (hash(code) !== participant.otp.hash) {
      appendAudit(session, 'OTP_FAILED', { participantId });
      if (participant.otp.attempts >= OTP_MAX_ATTEMPTS) {
        participant.otp.locked = true;
        appendAudit(session, 'OTP_LOCKED', { participantId });
      }
      persistSessions();
      return sendJson(res, 401, { error: 'Invalid OTP' });
    }

    participant.verified = true;
    participant.otp = { hash: null, expiresAt: null, attempts: 0, locked: false, lastSentAt: participant.otp.lastSentAt };
    appendAudit(session, 'OTP_VERIFIED', { participantId });
    if (session.participants.every(p => p.verified)) session.status = 'verified';
    session.updatedAt = nowISO();
    persistSessions();
    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error(err);
    sendJson(res, 400, { error: 'Unable to verify OTP' });
  }
}

module.exports = { sendOtp, verifyOtp };

const { randomUUID } = require('crypto');
const { signJwt } = require('../utils/jwt');
const { appendAudit, nowISO } = require('./audit');
const { sessions, persistSessions } = require('./sessions');
const { sendJson } = require('../serverHelpers');

async function issueVideoSession(req, res, sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return sendJson(res, 404, { error: 'Session not found' });
  if (!session.participants.every(p => p.verified)) return sendJson(res, 400, { error: 'All participants must verify OTP before starting video session' });

  const roomId = session.videoSession ? session.videoSession.roomId : randomUUID();
  const token = signJwt({ sessionId, roomId }, 3600); // 1 hour
  session.videoSession = { roomId, issuedAt: nowISO(), token };
  appendAudit(session, 'VIDEO_SESSION_ISSUED', { roomId });
  session.updatedAt = nowISO();
  persistSessions();

  sendJson(res, 200, { roomId, token });
}

module.exports = { issueVideoSession };

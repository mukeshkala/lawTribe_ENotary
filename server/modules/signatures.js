const { appendAudit, nowISO } = require('./audit');
const { sessions, persistSessions, cleanSession } = require('./sessions');
const { sendJson } = require('../serverHelpers');

async function captureSignature(req, res, sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return sendJson(res, 404, { error: 'Session not found' });

  try {
    const body = await require('../serverHelpers').parseBody(req);
    const { participantId, type, dataUrl, page, position } = body || {};
    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) return sendJson(res, 404, { error: 'Participant not found' });
    if (!participant.verified) return sendJson(res, 403, { error: 'Participant not verified' });
    if (!type || !['drawn', 'image'].includes(type)) return sendJson(res, 400, { error: 'Signature type invalid' });
    if (!dataUrl || !page || !position) return sendJson(res, 400, { error: 'Signature payload incomplete' });

    participant.signature = { type, dataUrl, page, position, signedAt: nowISO() };
    appendAudit(session, 'SIGNATURE_CAPTURED', { participantId, page, position });
    session.updatedAt = nowISO();
    persistSessions();
    sendJson(res, 200, { session: cleanSession(session) });
  } catch (err) {
    console.error(err);
    sendJson(res, 400, { error: 'Failed to store signature' });
  }
}

module.exports = { captureSignature };

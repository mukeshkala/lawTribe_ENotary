const { randomUUID } = require('crypto');
const { writeSessions, readSessions, maskAadhaar, maskEmail } = require('../utils/fsUtils');
const { hash } = require('../utils/hash');
const { nowISO, appendAudit } = require('../modules/audit'); // helper for audit trail
const sessions = new Map(Object.entries(readSessions()));

function persistSessions() {
  const obj = {};
  sessions.forEach((v, k) => (obj[k] = v));
  writeSessions(obj);
}

function cleanSession(session) {
  return {
    id: session.id,
    document: session.document,
    participants: session.participants.map(p => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      aadhaarMasked: p.aadhaarMasked,
      verified: p.verified,
      otp: p.otp,
      signature: p.signature || null,
    })),
    videoSession: session.videoSession,
    status: session.status,
    auditTrail: session.auditTrail,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

async function createSession(req, res, sendJson) {
  try {
    const body = await require('../serverHelpers').parseBody(req);
    const { document, participants } = body || {};
    if (!document?.uploadId) return sendJson(res, 400, { error: 'Document metadata required' });
    if (!Array.isArray(participants) || participants.length < 2) return sendJson(res, 400, { error: 'At least two participants required' });

    const sessionId = randomUUID();
    const session = {
      id: sessionId,
      document: { uploadId: document.uploadId, fileName: document.fileName, status: 'uploaded' },
      participants: participants.map(p => {
        const aadhaar = `${p.aadhaar || ''}`;
        if (!/^\d{12}$/.test(aadhaar)) throw new Error('Aadhaar must be 12 digits');
        return {
          id: randomUUID(),
          fullName: p.fullName,
          email: p.email,
          aadhaarMasked: maskAadhaar(aadhaar),
          aadhaarHash: hash(aadhaar + sessionId),
          verified: false,
          otp: { hash: null, expiresAt: null, attempts: 0, locked: false, lastSentAt: null },
          signature: null,
        };
      }),
      videoSession: null,
      auditTrail: [],
      status: 'otp_pending',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    appendAudit(session, 'SESSION_CREATED', { document: session.document.fileName, participantCount: session.participants.length });
    sessions.set(sessionId, session);
    persistSessions();
    sendJson(res, 201, { session: cleanSession(session) });
  } catch (err) {
    console.error(err);
    sendJson(res, 400, { error: err.message || 'Failed to create session' });
  }
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

module.exports = { createSession, getSession, cleanSession, sessions, persistSessions };

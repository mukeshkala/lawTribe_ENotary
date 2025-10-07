const { randomUUID } = require('crypto');

function nowISO() {
  return new Date().toISOString();
}

function appendAudit(session, eventType, details) {
  const previous = session.auditTrail.length ? session.auditTrail[session.auditTrail.length - 1] : null;
  const base = { id: randomUUID(), eventType, timestamp: nowISO(), details, prevHash: previous?.hash || null };
  const { hash } = require('../utils/hash');
  const hashInput = `${base.prevHash || ''}|${base.timestamp}|${eventType}|${JSON.stringify(details)}`;
  base.hash = hash(hashInput);
  session.auditTrail.push(base);
}

module.exports = { nowISO, appendAudit };

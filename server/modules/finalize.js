const fs = require('fs');
const path = require('path');
const { appendAudit, nowISO } = require('./audit');
const { sessions, persistSessions, cleanSession } = require('./sessions');
const { sendJson } = require('../serverHelpers');
const { createSimplePdf } = require('../utils/pdf');
const { hash } = require('../utils/hash');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const CERT_DIR = path.join(__dirname, '../certificates');
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

async function finalizeSession(req, res, sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return sendJson(res, 404, { error: 'Session not found' });

  if (!session.participants.every(p => p.signature)) {
    return sendJson(res, 400, { error: 'All signatures must be captured before finalisation' });
  }

  const uploadPath = path.join(UPLOAD_DIR, `${session.document.uploadId}.pdf`);
  if (!fs.existsSync(uploadPath)) return sendJson(res, 500, { error: 'Uploaded document missing' });

  const buffer = fs.readFileSync(uploadPath);
  const docHash = hash(buffer);

  session.document.status = 'finalised';
  session.document.hash = docHash;
  session.status = 'finalised';
  session.finalisedAt = nowISO();
  appendAudit(session, 'DOCUMENT_FINALISED', { hash: docHash });

  const certificate = {
    sessionId,
    document: { fileName: session.document.fileName, hash: docHash },
    participants: session.participants.map(p => ({
      fullName: p.fullName,
      emailMasked: p.email,
      signature: p.signature,
    })),
    signedAt: session.finalisedAt,
    videoSession: session.videoSession,
    auditTrail: session.auditTrail,
  };

  const certJsonPath = path.join(CERT_DIR, `${sessionId}.json`);
  fs.writeFileSync(certJsonPath, JSON.stringify(certificate, null, 2));

  const pdfContent = createSimplePdf(certificate);
  const certPdfPath = path.join(CERT_DIR, `${sessionId}.pdf`);
  fs.writeFileSync(certPdfPath, pdfContent);

  appendAudit(session, 'CERTIFICATE_GENERATED', { certificateJson: certJsonPath, certificatePdf: certPdfPath });
  persistSessions();

  sendJson(res, 200, {
    hash: docHash,
    certificate: { json: `/certificates/${sessionId}.json`, pdf: `/certificates/${sessionId}.pdf` },
    session: cleanSession(session),
  });
}

module.exports = { finalizeSession };

// const http = require('http');
// const path = require('path');
// const fs = require('fs');
// const { randomUUID, createHash } = require('crypto');
// const url = require('url');

// const DATA_DIR = path.join(__dirname, 'data');
// const UPLOAD_DIR = path.join(__dirname, 'uploads');
// const CERT_DIR = path.join(__dirname, 'certificates');
// const CLIENT_DIR = path.join(__dirname, '..', 'client');

// const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
// const OTP_TTL_MS = 5 * 60 * 1000;
// const OTP_MAX_ATTEMPTS = 5;
// const DEMO_PROTEAN_OTP = process.env.DEMO_OTP || '123456';
// const PORT = process.env.PORT || 4000;

// if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
// if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

// const storeFile = path.join(DATA_DIR, 'sessions.json');
// const sessions = new Map();

// function loadSessions() {
//   if (fs.existsSync(storeFile)) {
//     try {
//       const raw = fs.readFileSync(storeFile, 'utf-8');
//       const parsed = JSON.parse(raw);
//       Object.values(parsed).forEach((session) => {
//         sessions.set(session.id, session);
//       });
//     } catch (error) {
//       console.error('Failed to load sessions store', error);
//     }
//   }
// }

// function persistSessions() {
//   const serialisable = {};
//   sessions.forEach((session, id) => {
//     serialisable[id] = session;
//   });
//   fs.writeFileSync(storeFile, JSON.stringify(serialisable, null, 2));
// }

// function hash(value) {
//   return createHash('sha256').update(value).digest('hex');
// }

// function maskEmail(email) {
//   const [local, domain] = email.split('@');
//   if (!domain) return '***';
//   const maskedLocal = local[0] + '***' + local.slice(-1);
//   const parts = domain.split('.');
//   const maskedDomain = parts
//     .map((part, index) => (index === 0 ? part[0] + '***' : part))
//     .join('.');
//   return `${maskedLocal}@${maskedDomain}`;
// }

// function maskAadhaar(aadhaar) {
//   return `XXXX-XXXX-${aadhaar.slice(-4)}`;
// }

// function nowISO() {
//   return new Date().toISOString();
// }

// function appendAudit(session, eventType, details) {
//   const previous = session.auditTrail.length
//     ? session.auditTrail[session.auditTrail.length - 1]
//     : null;
//   const base = {
//     id: randomUUID(),
//     eventType,
//     timestamp: nowISO(),
//     details,
//     prevHash: previous ? previous.hash : null,
//   };
//   const hashInput = `${base.prevHash || ''}|${base.timestamp}|${eventType}|${JSON.stringify(details)}`;
//   base.hash = hash(hashInput);
//   session.auditTrail.push(base);
// }

// function generateOtp() {
//   // During Protean integration bring-up we rely on a deterministic OTP so that
//   // the front-end can validate the flow without external dependencies.
//   return DEMO_PROTEAN_OTP;
// }

// function signJwt(payload, expiresInSeconds = 300) {
//   const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
//   const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
//   const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
//   const signature = createHash('sha256')
//     .update(`${header}.${body}${JWT_SECRET}`)
//     .digest('base64url');
//   return `${header}.${body}.${signature}`;
// }

// function verifyJwt(token) {
//   const [header, body, signature] = token.split('.');
//   if (!header || !body || !signature) return null;
//   const check = createHash('sha256')
//     .update(`${header}.${body}${JWT_SECRET}`)
//     .digest('base64url');
//   if (check !== signature) return null;
//   const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
//   if (decoded.exp * 1000 < Date.now()) return null;
//   return decoded;
// }

// function parseBody(req) {
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     req.on('data', (chunk) => chunks.push(chunk));
//     req.on('end', () => {
//       if (!chunks.length) {
//         resolve(null);
//         return;
//       }
//       const raw = Buffer.concat(chunks).toString('utf-8');
//       if (!raw) {
//         resolve(null);
//         return;
//       }
//       try {
//         const parsed = JSON.parse(raw);
//         resolve(parsed);
//       } catch (error) {
//         reject(error);
//       }
//     });
//     req.on('error', reject);
//   });
// }

// function sendJson(res, statusCode, payload) {
//   const data = JSON.stringify(payload);
//   res.writeHead(statusCode, {
//     'Content-Type': 'application/json',
//     'Content-Length': Buffer.byteLength(data),
//   });
//   res.end(data);
// }

// function sendText(res, statusCode, text, type = 'text/plain') {
//   res.writeHead(statusCode, {
//     'Content-Type': type,
//     'Content-Length': Buffer.byteLength(text),
//   });
//   res.end(text);
// }

// function serveStaticFile(res, filePath) {
//   if (!fs.existsSync(filePath)) {
//     res.writeHead(404);
//     res.end('Not Found');
//     return;
//   }
//   const stream = fs.createReadStream(filePath);
//   const ext = path.extname(filePath);
//   const typeMap = {
//     '.html': 'text/html',
//     '.css': 'text/css',
//     '.js': 'application/javascript',
//     '.json': 'application/json',
//     '.png': 'image/png',
//     '.jpg': 'image/jpeg',
//     '.svg': 'image/svg+xml',
//   };
//   res.writeHead(200, { 'Content-Type': typeMap[ext] || 'application/octet-stream' });
//   stream.pipe(res);
// }

// function cleanSession(session) {
//   return {
//     id: session.id,
//     document: session.document,
//     participants: session.participants.map((participant) => ({
//       id: participant.id,
//       fullName: participant.fullName,
//       email: participant.email,
//       aadhaarMasked: participant.aadhaarMasked,
//       verified: participant.verified,
//       otp: {
//         locked: participant.otp.locked,
//         attempts: participant.otp.attempts,
//         expiresAt: participant.otp.expiresAt,
//         lastSentAt: participant.otp.lastSentAt,
//       },
//       signature: participant.signature || null,
//     })),
//     videoSession: session.videoSession,
//     status: session.status,
//     auditTrail: session.auditTrail,
//     createdAt: session.createdAt,
//     updatedAt: session.updatedAt,
//   };
// }

// loadSessions();

// const server = http.createServer(async (req, res) => {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
//   if (req.method === 'OPTIONS') {
//     res.writeHead(204);
//     res.end();
//     return;
//   }

//   const parsedUrl = url.parse(req.url, true);
//   const { pathname } = parsedUrl;

//   if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
//     serveStaticFile(res, path.join(CLIENT_DIR, 'index.html'));
//     return;
//   }

//   if (req.method === 'GET' && /^\/(styles\.css|app\.js)$/.test(pathname)) {
//     serveStaticFile(res, path.join(CLIENT_DIR, pathname.replace('/', '')));
//     return;
//   }

//   if (req.method === 'GET' && pathname.startsWith('/assets/')) {
//     serveStaticFile(res, path.join(CLIENT_DIR, pathname));
//     return;
//   }

//   if (req.method === 'GET' && pathname === '/api/health') {
//     sendJson(res, 200, { status: 'ok', timestamp: nowISO() });
//     return;
//   }

//   if (req.method === 'POST' && pathname === '/api/uploads') {
//     try {
//       const body = await parseBody(req);
//       if (!body || !body.fileName || !body.content) {
//         sendJson(res, 400, { error: 'Invalid payload' });
//         return;
//       }
//       const uploadId = randomUUID();
//       const fileBuffer = Buffer.from(body.content, 'base64');
//       const filePath = path.join(UPLOAD_DIR, `${uploadId}.pdf`);
//       fs.writeFileSync(filePath, fileBuffer);
//       const previewPath = path.join(UPLOAD_DIR, `${uploadId}.preview.txt`);
//       fs.writeFileSync(previewPath, `Preview unavailable in this environment. Uploaded file: ${body.fileName}`);
//       sendJson(res, 200, {
//         uploadId,
//         fileName: body.fileName,
//         storedAt: `/uploads/${uploadId}.pdf`,
//         preview: `/api/uploads/${uploadId}/preview`,
//       });
//     } catch (error) {
//       console.error(error);
//       sendJson(res, 500, { error: 'Failed to save upload' });
//     }
//     return;
//   }

//   if (req.method === 'GET' && /^\/api\/uploads\/([\w-]+)\/preview$/.test(pathname)) {
//     const match = pathname.match(/^\/api\/uploads\/([\w-]+)\/preview$/);
//     const uploadId = match[1];
//     const previewPath = path.join(UPLOAD_DIR, `${uploadId}.preview.txt`);
//     if (!fs.existsSync(previewPath)) {
//       sendJson(res, 404, { error: 'Preview not found' });
//       return;
//     }
//     const content = fs.readFileSync(previewPath, 'utf-8');
//     sendText(res, 200, content, 'text/plain');
//     return;
//   }

//   if (req.method === 'POST' && pathname === '/api/sessions') {
//     try {
//       const body = await parseBody(req);
//       const { document, participants } = body || {};
//       if (!document || !document.uploadId) {
//         sendJson(res, 400, { error: 'Document metadata required' });
//         return;
//       }
//       if (!Array.isArray(participants) || participants.length < 2) {
//         sendJson(res, 400, { error: 'At least two participants required' });
//         return;
//       }
//       const sessionId = randomUUID();
//       const session = {
//         id: sessionId,
//         document: {
//           uploadId: document.uploadId,
//           fileName: document.fileName,
//           status: 'uploaded',
//         },
//         participants: participants.map((participant) => {
//           const aadhaar = `${participant.aadhaar || ''}`;
//           if (!/^\d{12}$/.test(aadhaar)) {
//             throw new Error('Aadhaar must be 12 digits');
//           }
//           return {
//             id: randomUUID(),
//             fullName: participant.fullName,
//             email: participant.email,
//             aadhaarMasked: maskAadhaar(aadhaar),
//             aadhaarHash: hash(aadhaar + sessionId),
//             verified: false,
//             otp: {
//               hash: null,
//               expiresAt: null,
//               attempts: 0,
//               locked: false,
//               lastSentAt: null,
//             },
//             signature: null,
//           };
//         }),
//         videoSession: null,
//         auditTrail: [],
//         status: 'otp_pending',
//         createdAt: nowISO(),
//         updatedAt: nowISO(),
//       };
//       appendAudit(session, 'SESSION_CREATED', {
//         document: session.document.fileName,
//         participantCount: session.participants.length,
//       });
//       sessions.set(sessionId, session);
//       persistSessions();
//       sendJson(res, 201, { session: cleanSession(session) });
//     } catch (error) {
//       console.error(error);
//       sendJson(res, 400, { error: error.message || 'Failed to create session' });
//     }
//     return;
//   }

//   if (req.method === 'GET' && /^\/api\/sessions\/[\w-]+$/.test(pathname)) {
//     const sessionId = pathname.split('/')[3];
//     const session = sessions.get(sessionId);
//     if (!session) {
//       sendJson(res, 404, { error: 'Session not found' });
//       return;
//     }
//     sendJson(res, 200, { session: cleanSession(session) });
//     return;
//   }

//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/otp\/[\w-]+\/send$/.test(pathname)) {
//     const [, , , sessionId, , participantId] = pathname.split('/');
//     const session = sessions.get(sessionId);
//     if (!session) {
//       sendJson(res, 404, { error: 'Session not found' });
//       return;
//     }
//     const participant = session.participants.find((p) => p.id === participantId);
//     if (!participant) {
//       sendJson(res, 404, { error: 'Participant not found' });
//       return;
//     }
//     if (participant.otp.locked) {
//       sendJson(res, 423, { error: 'OTP locked. Please contact support.' });
//       return;
//     }
//     const otp = generateOtp();
//     participant.otp.hash = hash(otp);
//     participant.otp.expiresAt = Date.now() + OTP_TTL_MS;
//     participant.otp.attempts = 0;
//     participant.otp.lastSentAt = nowISO();
//     appendAudit(session, 'OTP_SENT', {
//       participantId,
//       emailMasked: maskEmail(participant.email),
//     });
//     persistSessions();
//     sendJson(res, 200, {
//       message: 'OTP dispatched via secure channels',
//       expiresAt: participant.otp.expiresAt,
//     });
//     return;
//   }

//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/otp\/[\w-]+\/verify$/.test(pathname)) {
//     const [, , , sessionId, , participantId] = pathname.split('/');
//     const session = sessions.get(sessionId);
//     if (!session) {
//       sendJson(res, 404, { error: 'Session not found' });
//       return;
//     }
//     const participant = session.participants.find((p) => p.id === participantId);
//     if (!participant) {
//       sendJson(res, 404, { error: 'Participant not found' });
//       return;
//     }
//     if (participant.otp.locked) {
//       sendJson(res, 423, { error: 'OTP locked. Please contact support.' });
//       return;
//     }
//     try {
//       const body = await parseBody(req);
//       const provided = body ? body.code : null;
//       if (!provided) {
//         sendJson(res, 400, { error: 'OTP code required' });
//         return;
//       }
//       if (!participant.otp.hash || !participant.otp.expiresAt) {
//         sendJson(res, 400, { error: 'OTP not generated yet' });
//         return;
//       }
//       if (participant.otp.expiresAt < Date.now()) {
//         participant.otp.hash = null;
//         participant.otp.expiresAt = null;
//         participant.otp.attempts = 0;
//         appendAudit(session, 'OTP_EXPIRED', { participantId });
//         persistSessions();
//         sendJson(res, 410, { error: 'OTP expired' });
//         return;
//       }
//       participant.otp.attempts += 1;
//       if (hash(provided) !== participant.otp.hash) {
//         appendAudit(session, 'OTP_FAILED', { participantId });
//         if (participant.otp.attempts >= OTP_MAX_ATTEMPTS) {
//           participant.otp.locked = true;
//           appendAudit(session, 'OTP_LOCKED', { participantId });
//         }
//         persistSessions();
//         sendJson(res, 401, { error: 'Invalid OTP' });
//         return;
//       }
//       participant.verified = true;
//       participant.otp.hash = null;
//       participant.otp.expiresAt = null;
//       participant.otp.attempts = 0;
//       appendAudit(session, 'OTP_VERIFIED', { participantId });
//       if (session.participants.every((p) => p.verified)) {
//         session.status = 'verified';
//       }
//       session.updatedAt = nowISO();
//       persistSessions();
//       sendJson(res, 200, { success: true, session: cleanSession(session) });
//     } catch (error) {
//       console.error(error);
//       sendJson(res, 400, { error: 'Unable to verify OTP' });
//     }
//     return;
//   }

//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/video$/.test(pathname)) {
//     const sessionId = pathname.split('/')[3];
//     const session = sessions.get(sessionId);
//     if (!session) {
//       sendJson(res, 404, { error: 'Session not found' });
//       return;
//     }
//     if (!session.participants.every((p) => p.verified)) {
//       sendJson(res, 400, { error: 'All participants must verify OTP before starting video session' });
//       return;
//     }
//     const roomId = session.videoSession ? session.videoSession.roomId : randomUUID();
//     const token = signJwt({ sessionId, roomId }, 3600);
//     session.videoSession = { roomId, issuedAt: nowISO(), token }; 
//     appendAudit(session, 'VIDEO_SESSION_ISSUED', { roomId });
//     session.updatedAt = nowISO();
//     persistSessions();
//     sendJson(res, 200, { roomId, token });
//     return;
//   }

//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/signatures$/.test(pathname)) {
//     const sessionId = pathname.split('/')[3];
//     const session = sessions.get(sessionId);
//     if (!session) {
//       sendJson(res, 404, { error: 'Session not found' });
//       return;
//     }
//     try {
//       const body = await parseBody(req);
//       const { participantId, type, dataUrl, page, position } = body || {};
//       const participant = session.participants.find((p) => p.id === participantId);
//       if (!participant) {
//         sendJson(res, 404, { error: 'Participant not found' });
//         return;
//       }
//       if (!participant.verified) {
//         sendJson(res, 403, { error: 'Participant not verified' });
//         return;
//       }
//       if (!type || !['drawn', 'image'].includes(type)) {
//         sendJson(res, 400, { error: 'Signature type invalid' });
//         return;
//       }
//       if (!dataUrl || !page || !position) {
//         sendJson(res, 400, { error: 'Signature payload incomplete' });
//         return;
//       }
//       participant.signature = {
//         type,
//         dataUrl,
//         page,
//         position,
//         signedAt: nowISO(),
//       };
//       appendAudit(session, 'SIGNATURE_CAPTURED', {
//         participantId,
//         page,
//         position,
//       });
//       session.updatedAt = nowISO();
//       persistSessions();
//       sendJson(res, 200, { session: cleanSession(session) });
//     } catch (error) {
//       console.error(error);
//       sendJson(res, 400, { error: 'Failed to store signature' });
//     }
//     return;
//   }

//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/finalize$/.test(pathname)) {
//     const sessionId = pathname.split('/')[3];
//     const session = sessions.get(sessionId);
//     if (!session) {
//       sendJson(res, 404, { error: 'Session not found' });
//       return;
//     }
//     if (!session.participants.every((p) => p.signature)) {
//       sendJson(res, 400, { error: 'All signatures must be captured before finalisation' });
//       return;
//     }
//     const uploadPath = path.join(UPLOAD_DIR, `${session.document.uploadId}.pdf`);
//     if (!fs.existsSync(uploadPath)) {
//       sendJson(res, 500, { error: 'Uploaded document missing' });
//       return;
//     }
//     const buffer = fs.readFileSync(uploadPath);
//     const docHash = hash(buffer);
//     session.document.status = 'finalised';
//     session.document.hash = docHash;
//     session.status = 'finalised';
//     session.finalisedAt = nowISO();
//     appendAudit(session, 'DOCUMENT_FINALISED', { hash: docHash });

//     const certificate = {
//       sessionId,
//       document: {
//         fileName: session.document.fileName,
//         hash: docHash,
//       },
//       participants: session.participants.map((p) => ({
//         fullName: p.fullName,
//         emailMasked: maskEmail(p.email),
//         signature: p.signature,
//       })),
//       signedAt: session.finalisedAt,
//       videoSession: session.videoSession,
//       auditTrail: session.auditTrail,
//     };

//     const certJsonPath = path.join(CERT_DIR, `${sessionId}.json`);
//     fs.writeFileSync(certJsonPath, JSON.stringify(certificate, null, 2));

//     const pdfContent = createSimplePdf(certificate);
//     const certPdfPath = path.join(CERT_DIR, `${sessionId}.pdf`);
//     fs.writeFileSync(certPdfPath, pdfContent);

//     appendAudit(session, 'CERTIFICATE_GENERATED', {
//       certificateJson: certJsonPath,
//       certificatePdf: certPdfPath,
//     });
//     persistSessions();
//     sendJson(res, 200, {
//       hash: docHash,
//       certificate: {
//         json: `/certificates/${sessionId}.json`,
//         pdf: `/certificates/${sessionId}.pdf`,
//       },
//       session: cleanSession(session),
//     });
//     return;
//   }

//   if (req.method === 'GET' && pathname.startsWith('/certificates/')) {
//     const filePath = path.join(CERT_DIR, pathname.replace('/certificates/', ''));
//     serveStaticFile(res, filePath);
//     return;
//   }

//   if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
//     const filePath = path.join(UPLOAD_DIR, pathname.replace('/uploads/', ''));
//     serveStaticFile(res, filePath);
//     return;
//   }

//   res.writeHead(404);
//   res.end('Not Found');
// });

// function createSimplePdf(certificate) {
//   const lines = [
//     'Audit Certificate',
//     `Session: ${certificate.sessionId}`,
//     `Document: ${certificate.document.fileName}`,
//     `Hash: ${certificate.document.hash}`,
//     `Finalised: ${certificate.signedAt}`,
//     '',
//     'Participants:',
//     ...certificate.participants.map((p) => `- ${p.fullName} (${p.emailMasked}) signed on page ${p.signature.page}`),
//   ];
//   const content = lines.join(' ');
//   const text = `BT /F1 14 Tf 50 750 Td (${escapePdfText(content)}) Tj ET`;

//   const pdf = `
// %PDF-1.4
// 1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
// 2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
// 3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
// 4 0 obj << /Length ${text.length} >> stream
// ${text}
// endstream endobj
// 5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
// xref
// 0 6
// 0000000000 65535 f 
// 0000000010 00000 n 
// 0000000053 00000 n 
// 0000000100 00000 n 
// 0000000207 00000 n 
// 0000000311 00000 n 
// trailer << /Size 6 /Root 1 0 R >>
// startxref
// 361
// %%EOF
// `;
//   return Buffer.from(pdf.trim(), 'utf-8');
// }

// function escapePdfText(text) {
//   return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
// }

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

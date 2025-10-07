// const http = require('http');
// const url = require('url');
// const { PORT } = require('./config');
// const { parseBody, sendJson } = require('./serverHelpers');
// const { handleUpload } = require('./modules/uploads');
// const { createSession } = require('./modules/sessions');
// const { sendOtp, verifyOtp } = require('./modules/otp');
// const { issueVideoSession } = require('./modules/video');
// const { captureSignature } = require('./modules/signatures');
// const { finalizeSession } = require('./modules/finalize');

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
//   const pathname = parsedUrl.pathname;

//   // Upload endpoint
//   if (req.method === 'POST' && pathname === '/api/uploads') {
//     await handleUpload(req, res);
//     return;
//   }

//   // Create session
//   if (req.method === 'POST' && pathname === '/api/sessions') {
//     await createSession(req, res, sendJson);
//     return;
//   }

//   // OTP send
//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/otp\/[\w-]+\/send$/.test(pathname)) {
//     const [, , , sessionId, , participantId] = pathname.split('/');
//     await sendOtp(req, res, sessionId, participantId);
//     return;
//   }

//   // OTP verify
//   if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/otp\/[\w-]+\/verify$/.test(pathname)) {
//     const [, , , sessionId, , participantId] = pathname.split('/');
//     await verifyOtp(req, res, sessionId, participantId);
//     return;
//   }

//   // Video session
// if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/video$/.test(pathname)) {
//   const sessionId = pathname.split('/')[3];
//   await issueVideoSession(req, res, sessionId);
//   return;
// }

// // Capture signature
// if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/signatures$/.test(pathname)) {
//   const sessionId = pathname.split('/')[3];
//   await captureSignature(req, res, sessionId);
//   return;
// }

// // Finalize session
// if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/finalize$/.test(pathname)) {
//   const sessionId = pathname.split('/')[3];
//   await finalizeSession(req, res, sessionId);
//   return;
// }

//   sendJson(res, 404, { error: 'Not found' });
// });

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });



const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { PORT } = require('./config');
const { parseBody, sendJson } = require('./serverHelpers');
const { handleUpload } = require('./modules/uploads');
const { createSession } = require('./modules/sessions');
const { sendOtp, verifyOtp } = require('./modules/otp');
const { issueVideoSession } = require('./modules/video');
const { captureSignature } = require('./modules/signatures');
const { finalizeSession } = require('./modules/finalize');

// Serve static files from the client folder
function serveStaticFile(req, res) {
  let pathname = url.parse(req.url).pathname;
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(__dirname, 'client', pathname);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };

  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve static files
  if (req.method === 'GET' && serveStaticFile(req, res)) return;

  // API Endpoints
  if (req.method === 'POST' && pathname === '/api/uploads') {
    await handleUpload(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sessions') {
    await createSession(req, res, sendJson);
    return;
  }

  if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/otp\/[\w-]+\/send$/.test(pathname)) {
    const [, , , sessionId, , participantId] = pathname.split('/');
    await sendOtp(req, res, sessionId, participantId);
    return;
  }

  if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/otp\/[\w-]+\/verify$/.test(pathname)) {
    const [, , , sessionId, , participantId] = pathname.split('/');
    await verifyOtp(req, res, sessionId, participantId);
    return;
  }

  if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/video$/.test(pathname)) {
    const sessionId = pathname.split('/')[3];
    await issueVideoSession(req, res, sessionId);
    return;
  }

  if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/signatures$/.test(pathname)) {
    const sessionId = pathname.split('/')[3];
    await captureSignature(req, res, sessionId);
    return;
  }

  if (req.method === 'POST' && /^\/api\/sessions\/[\w-]+\/finalize$/.test(pathname)) {
    const sessionId = pathname.split('/')[3];
    await finalizeSession(req, res, sessionId);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

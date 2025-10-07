const { saveUpload } = require('../utils/fsUtils');
const { parseBody, sendJson } = require('../serverHelpers');

async function handleUpload(req, res) {
  try {
    const body = await parseBody(req);
    if (!body || !body.fileName || !body.content) {
      sendJson(res, 400, { error: 'Invalid payload' });
      return;
    }
    const upload = saveUpload(body.fileName, body.content);
    sendJson(res, 200, upload);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Failed to save upload' });
  }
}

module.exports = { handleUpload };

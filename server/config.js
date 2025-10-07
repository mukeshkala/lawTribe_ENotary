const path = require('path');

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  OTP_TTL_MS: 5 * 60 * 1000,
  OTP_MAX_ATTEMPTS: 5,
  DEMO_PROTEAN_OTP: process.env.DEMO_OTP || '123456',
  DATA_DIR: path.join(__dirname, 'data'),
  UPLOAD_DIR: path.join(__dirname, 'uploads'),
  CERT_DIR: path.join(__dirname, 'certificates'),
};

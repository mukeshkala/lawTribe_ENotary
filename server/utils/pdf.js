function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createSimplePdf(certificate) {
  const lines = [
    'Audit Certificate',
    `Session: ${certificate.sessionId}`,
    `Document: ${certificate.document.fileName}`,
    `Hash: ${certificate.document.hash}`,
    `Finalised: ${certificate.signedAt}`,
    '',
    'Participants:',
    ...certificate.participants.map(p => `- ${p.fullName} (${p.emailMasked}) signed on page ${p.signature.page}`),
  ];
  const content = lines.join(' ');
  const text = `BT /F1 14 Tf 50 750 Td (${escapePdfText(content)}) Tj ET`;

  const pdf = `
%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${text.length} >> stream
${text}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000100 00000 n 
0000000207 00000 n 
0000000311 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
361
%%EOF
  `;
  return Buffer.from(pdf.trim(), 'utf-8');
}

module.exports = { createSimplePdf };

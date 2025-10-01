const API_BASE = window.location.origin.replace(/\/$/, '');

const state = {
  currentStep: 1,
  upload: null,
  session: null,
};

const steps = Array.from(document.querySelectorAll('.step'));
const stepper = document.getElementById('stepper-list').children;

function setStep(step) {
  state.currentStep = step;
  steps.forEach((section, index) => {
    section.classList.toggle('active', index + 1 === step);
    stepper[index].classList.toggle('active', index + 1 === step);
  });
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

async function uploadFile(file) {
  const feedback = document.getElementById('upload-feedback');
  showMessage(feedback, 'Uploading…');
  const content = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(content)));
  const response = await fetch(`${API_BASE}/api/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, content: base64 }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(payload.error || 'Upload failed');
  }
  return response.json();
}

function renderParticipants(participants = []) {
  const container = document.getElementById('participants-container');
  container.innerHTML = '';
  const template = document.getElementById('participant-template');
  const roles = ['Signer', 'Signer / Witness', 'Notary'];
  const count = Math.max(participants.length, 2);
  for (let i = 0; i < count; i++) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-role]').textContent = roles[i] || `Participant ${i + 1}`;
    const values = participants[i] || { fullName: '', email: '', aadhaar: '' };
    node.querySelector('input[name="fullName"]').value = values.fullName;
    node.querySelector('input[name="email"]').value = values.email;
    node.querySelector('input[name="aadhaar"]').value = values.aadhaar;
    container.appendChild(node);
  }
}

function validateParticipants(form) {
  const data = [];
  let valid = true;
  const emailRegex = /^(?:[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:["]|\\")+")@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  form.querySelectorAll('.participant-card').forEach((card) => {
    const fullName = card.querySelector('input[name="fullName"]').value.trim();
    const email = card.querySelector('input[name="email"]').value.trim();
    const aadhaar = card.querySelector('input[name="aadhaar"]').value.trim();
    const errors = {
      fullName: fullName.length ? '' : 'Name is required',
      email: emailRegex.test(email) ? '' : 'Enter a valid email',
      aadhaar: /^\d{12}$/.test(aadhaar) ? '' : 'Aadhaar must be 12 digits',
    };
    Object.entries(errors).forEach(([key, message]) => {
      const errorElement = card.querySelector(`[data-error="${key}"]`);
      errorElement.textContent = message;
      if (message) valid = false;
    });
    data.push({ fullName, email, aadhaar });
  });
  return { valid, data };
}

async function createSession(payload) {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Session error' }));
    throw new Error(error.error || 'Session error');
  }
  return response.json();
}

async function fetchSession(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!response.ok) throw new Error('Session not found');
  return response.json();
}

function renderOtpControls(session) {
  const container = document.getElementById('otp-container');
  container.innerHTML = '';
  const template = document.getElementById('otp-template');
  session.participants.forEach((participant) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.participantId = participant.id;
    node.querySelector('[data-name]').textContent = participant.fullName;
    node.querySelector('[data-email]').textContent = participant.email;
    const status = node.querySelector('[data-status]');
    status.textContent = participant.verified ? 'Verified' : 'Awaiting verification';
    node.querySelector('[data-action="send"]').addEventListener('click', async () => {
      status.textContent = 'Dispatching…';
      const response = await fetch(`${API_BASE}/api/sessions/${session.id}/otp/${participant.id}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unable to send OTP' }));
        status.textContent = error.error;
        return;
      }
      status.textContent = 'OTP sent. Check email and SMS channels.';
    });
    node.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const code = formData.get('code');
      status.textContent = 'Verifying…';
      const response = await fetch(`${API_BASE}/api/sessions/${session.id}/otp/${participant.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        status.textContent = payload.error || 'Unable to verify';
        return;
      }
      state.session = payload.session;
      status.textContent = 'Verified';
      updateOtpState();
    });
    container.appendChild(node);
  });
}

function updateOtpState() {
  const session = state.session;
  if (!session) return;
  const nextButton = document.getElementById('otp-next');
  renderOtpControls(session);
  const allVerified = session.participants.every((p) => p.verified);
  nextButton.disabled = !allVerified;
  document.getElementById('start-video').disabled = !allVerified;
  if (allVerified) {
    document.getElementById('video-status').textContent = 'All participants verified. Ready to generate room token.';
  }
}

async function issueVideoToken(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/video`, { method: 'POST' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Unable to issue token' }));
    throw new Error(payload.error || 'Unable to issue token');
  }
  return response.json();
}

function renderSignatures(session) {
  const container = document.getElementById('signature-container');
  container.innerHTML = '';
  const template = document.getElementById('signature-template');
  session.participants.forEach((participant) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.participantId = participant.id;
    node.querySelector('[data-name]').textContent = participant.fullName;
    const status = node.querySelector('[data-status]');
    status.textContent = participant.signature ? `Signed at ${participant.signature.signedAt}` : 'Pending signature';
    node.querySelector('[data-action="submit"]').addEventListener('click', async () => {
      const dataUrl = node.querySelector('textarea[name="dataUrl"]').value.trim();
      const page = Number(node.querySelector('input[name="page"]').value || 1);
      const positionRaw = node.querySelector('input[name="position"]').value.trim();
      let position;
      try {
        position = JSON.parse(positionRaw.replace(/&quot;/g, '"'));
      } catch (error) {
        status.textContent = 'Position must be valid JSON';
        return;
      }
      status.textContent = 'Uploading signature…';
      const response = await fetch(`${API_BASE}/api/sessions/${session.id}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id, type: 'drawn', dataUrl, page, position }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        status.textContent = payload.error || 'Unable to store signature';
        return;
      }
      state.session = payload.session;
      status.textContent = 'Signature captured.';
      renderSignatures(state.session);
      updateFinaliseState();
    });
    container.appendChild(node);
  });
}

async function finaliseSession(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/finalize`, { method: 'POST' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Finalisation failed' }));
    throw new Error(payload.error || 'Finalisation failed');
  }
  return response.json();
}

function updateFinaliseState() {
  const session = state.session;
  if (!session) return;
  const allSigned = session.participants.every((p) => p.signature);
  document.getElementById('session-next').disabled = !allSigned;
  document.getElementById('finalise').disabled = !allSigned;
  const summary = document.getElementById('finalise-summary');
  summary.innerHTML = `
    <h3>Ready for evidence package</h3>
    <ul>
      ${session.participants
        .map((p) => `<li>${p.fullName} — ${p.signature ? 'Signed' : 'Pending'}</li>`)
        .join('')}
    </ul>
  `;
}

function setPreview(upload) {
  const preview = document.getElementById('preview-content');
  if (!upload) {
    preview.textContent = 'Preview unavailable';
    return;
  }
  fetch(upload.preview)
    .then((response) => response.text())
    .then((text) => {
      preview.textContent = text;
    })
    .catch(() => {
      preview.textContent = 'Preview unavailable';
    });
}

function initialise() {
  renderParticipants();
  const fileInput = document.getElementById('file-input');
  const uploadButton = document.getElementById('upload-next');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    uploadButton.disabled = true;
    try {
      const upload = await uploadFile(file);
      state.upload = upload;
      document.getElementById('upload-feedback').textContent = 'Upload complete. Continue to participants.';
      uploadButton.disabled = false;
    } catch (error) {
      document.getElementById('upload-feedback').textContent = error.message;
    }
  });

  uploadButton.addEventListener('click', () => {
    if (!state.upload) return;
    setStep(2);
  });

  document.getElementById('add-participant').addEventListener('click', () => {
    const container = document.getElementById('participants-container');
    const template = document.getElementById('participant-template');
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-role]').textContent = `Participant ${container.children.length + 1}`;
    container.appendChild(node);
  });

  document.getElementById('participants-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { valid, data } = validateParticipants(event.currentTarget);
    if (!valid) return;
    try {
      const payload = await createSession({
        document: { uploadId: state.upload.uploadId, fileName: state.upload.fileName },
        participants: data,
      });
      state.session = payload.session;
      setPreview(state.upload);
      renderOtpControls(state.session);
      setStep(3);
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('otp-next').addEventListener('click', () => {
    setStep(4);
    renderSignatures(state.session);
    updateFinaliseState();
  });

  document.getElementById('start-video').addEventListener('click', async () => {
    try {
      const { roomId, token } = await issueVideoToken(state.session.id);
      state.session.videoSession = { roomId, token };
      document.getElementById('video-status').textContent = `Room ${roomId} issued. Token ${token.slice(0, 12)}…`;
      document.getElementById('session-next').disabled = false;
    } catch (error) {
      document.getElementById('video-status').textContent = error.message;
    }
  });

  document.getElementById('session-next').addEventListener('click', () => {
    setStep(5);
    updateFinaliseState();
  });

  document.getElementById('finalise').addEventListener('click', async () => {
    const feedback = document.getElementById('finalise-feedback');
    feedback.textContent = 'Generating evidence…';
    try {
      const payload = await finaliseSession(state.session.id);
      feedback.innerHTML = `
        <strong>Success.</strong> Hash ${payload.hash}<br />
        <a href="${payload.certificate.json}" target="_blank" rel="noopener">Download JSON certificate</a><br />
        <a href="${payload.certificate.pdf}" target="_blank" rel="noopener">Download PDF certificate</a>
      `;
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
}

document.addEventListener('DOMContentLoaded', initialise);

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
    const sendButton = node.querySelector('[data-action="send"]');
    const form = node.querySelector('form');
    const codeInput = form.querySelector('input[name="code"]');
    const verifyButton = form.querySelector('button[type="submit"]');
    const isVerified = Boolean(participant.verified);
    status.textContent = isVerified ? 'Verified' : 'Awaiting verification';
    node.classList.toggle('verified', isVerified);
    sendButton.disabled = isVerified;
    codeInput.disabled = isVerified;
    verifyButton.disabled = isVerified;

    if (!isVerified) {
      sendButton.addEventListener('click', async () => {
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

      form.addEventListener('submit', async (event) => {
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
    }
    container.appendChild(node);
  });
}

function updateOtpState() {
  const session = state.session;
  if (!session) return;
  renderOtpControls(session);
  const allVerified = session.participants.every((p) => p.verified);
  const completion = document.getElementById('otp-completion');
  if (completion) {
    if (allVerified) {
      completion.textContent = 'All participants verified. Process complete.';
      completion.classList.add('success');
    } else {
      const remaining = session.participants.filter((p) => !p.verified).length;
      completion.textContent = `${remaining} participant${remaining === 1 ? '' : 's'} awaiting verification.`;
      completion.classList.remove('success');
    }
  }
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
      setStep(3);
      updateOtpState();
    } catch (error) {
      alert(error.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', initialise);

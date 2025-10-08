// function determineApiBase() {
//   const { hostname, protocol } = window.location;

//   // 1️⃣ Explicit override (for debugging or global injection)
//   if (window.API_BASE_URL) {
//     return window.API_BASE_URL.replace(/\/$/, '');
//   }

//   // 2️⃣ Local development
//   if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
//     return `${protocol}//${hostname}:4000`;
//   }

//   // 3️⃣ UAT environment
//   if (hostname.includes('uat.lawtribe.in')) {
//     return 'https://uat.lawtribe.in';
//   }

//   // 4️⃣ Production (default)
//   return 'https://enotary.lawtribe.in';
// }

// // 👇 Global constant for all API calls
// const API_BASE = determineApiBase();
// console.info('🌐 Using API Base:', API_BASE);

// const state = {
//   upload: null,
//   participants: [],
//   session: null,
// };

// const emailRegex = /^(?:[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\\"]|\\\\")+")@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
// const aadhaarRegex = /^\d{12}$/;

// const steps = Array.from(document.querySelectorAll('.step'));
// const stepperItems = Array.from(document.querySelectorAll('#stepper-list li'));

// const uploadFeedback = document.getElementById('upload-feedback');
// const fileInput = document.getElementById('file-input');
// const uploadNextButton = document.getElementById('upload-next');

// const dropzone = document.querySelector('.dropzone');

// const participantsForm = document.getElementById('participants-form');
// const participantsContainer = document.getElementById('participants-container');
// const addParticipantButton = document.getElementById('add-participant');
// const participantTemplate = document.getElementById('participant-template');

// const otpContainer = document.getElementById('otp-container');
// const otpTemplate = document.getElementById('otp-template');
// const otpCompletionMessage = document.getElementById('otp-completion');

// let currentStep = 0;

// function goToStep(index) {
//   currentStep = index;
//   steps.forEach((step, idx) => {
//     const active = idx === index;
//     step.classList.toggle('active', active);
//     step.setAttribute('aria-hidden', active ? 'false' : 'true');
//   });
//   stepperItems.forEach((item, idx) => {
//     item.classList.toggle('active', idx === index);
//     if (idx < index) {
//       item.classList.add('complete');
//     } else {
//       item.classList.remove('complete');
//     }
//   });
// }

// function randomId() {
//   if (window.crypto && typeof window.crypto.randomUUID === 'function') {
//     return window.crypto.randomUUID();
//   }
//   return Math.random().toString(36).slice(2);
// }

// function createParticipant(role) {
//   return {
//     id: randomId(),
//     role,
//     fullName: '',
//     email: '',
//     aadhaar: '',
//   };
// }

// function setUploadFeedback(message, variant = 'info') {
//   uploadFeedback.textContent = message;
//   uploadFeedback.className = 'feedback';
//   if (variant === 'success') {
//     uploadFeedback.classList.add('success');
//   } else if (variant === 'error') {
//     uploadFeedback.classList.add('error');
//   }
// }

// function resetOtpStep() {
//   state.session = null;
//   otpContainer.innerHTML = '';
//   otpCompletionMessage.textContent = '';
//   otpCompletionMessage.className = 'feedback';
// }

// async function verifyOtpWithProtean(participant, code) {
//   // TODO: Replace this stub with an integration to the Protean verification API.
//   // The actual implementation should call the remote service with the participant's
//   // Aadhaar number and OTP code, and resolve based on the API response.
//   console.info('Invoking Protean OTP verification (placeholder)', {
//     participantId: participant?.id,
//     aadhaar: participant?.aadhaar,
//   });

//   // Simulate network latency so the UI reflects an asynchronous call.
//   await new Promise((resolve) => setTimeout(resolve, 400));

//   const success = code === '123456';

//   return {
//     success,
//     message: success
//       ? 'Authentication successful (demo OTP 123456).'
//       : 'Authentication failed. Use OTP 123456 while testing.',
//   };
// }

// function readFileAsBase64(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onerror = () => reject(new Error('Unable to read file'));
//     reader.onload = () => {
//       const result = reader.result;
//       if (typeof result !== 'string') {
//         reject(new Error('Unsupported file encoding'));
//         return;
//       }
//       const [, base64] = result.split(',');
//       if (!base64) {
//         reject(new Error('Failed to encode file'));
//         return;
//       }
//       resolve(base64);
//     };
//     reader.readAsDataURL(file);
//   });
// }


// let uploadInProgress = false;

// async function processFile(file) {
//   if (uploadInProgress || !file) return;
//   uploadInProgress = true;

//   if (file.type !== 'application/pdf') {
//     setUploadFeedback('Please upload a PDF document.', 'error');
//     uploadInProgress = false;
//     return;
//   }

//   if (file.size > 10 * 1024 * 1024) {
//     setUploadFeedback('The PDF must be smaller than 10 MB.', 'error');
//     uploadInProgress = false;
//     return;
//   }

//   setUploadFeedback(`Uploading ${file.name}…`);
//   uploadNextButton.disabled = true;

//   try {
//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('fileName', file.name);

//     const response = await fetch(`${API_BASE}/api/uploads`, {
//       method: 'POST',
//       body: formData,
//     });

//     const payload = await response.json().catch(() => ({}));
//     if (!response.ok) throw new Error(payload.error || 'Upload failed');

//     state.upload = payload;
//     setUploadFeedback(`Uploaded ${payload.fileName}. Continue to participants.`, 'success');
//     resetOtpStep();
//   } catch (err) {
//     console.error('❌ Upload error:', err);
//     state.upload = null;
//     setUploadFeedback(err.message || 'Upload failed', 'error');
//   } finally {
//     uploadNextButton.disabled = !state.upload;
//     uploadInProgress = false;
//       document.activeElement?.blur();  // Removes focus so dialog won’t reopen
//     recreateFileInput(); // ✅ rebuild input after upload
//   }
// }


// function recreateFileInput() {
//   const oldInput = document.getElementById('file-input');
//   const newInput = oldInput.cloneNode(true);
//   oldInput.replaceWith(newInput);

//   // 👇 Reattach listeners safely
//   newInput.addEventListener('change', (e) => {
//     const file = e.target.files[0];
//     if (file) processFile(file);
//   });

//   // 👇 Prevent auto focus or implicit click
//   newInput.blur();
// }



// function clearFieldError(fieldset, field) {
//   const target = fieldset.querySelector(`[data-error="${field}"]`);
//   if (target) {
//     target.textContent = '';
//   }
// }

// function renderParticipants() {
//   participantsContainer.innerHTML = '';
//   state.participants.forEach((participant, index) => {
//     const fragment = participantTemplate.content.cloneNode(true);
//     const fieldset = fragment.querySelector('fieldset');
//     fieldset.dataset.participantId = participant.id;

//     const roleLabel = fragment.querySelector('[data-role]');
//     roleLabel.textContent = participant.role || `Participant ${index + 1}`;

//     const fullNameInput = fieldset.querySelector('input[name="fullName"]');
//     fullNameInput.value = participant.fullName;
//     fullNameInput.addEventListener('input', (event) => {
//       participant.fullName = event.target.value;
//       clearFieldError(fieldset, 'fullName');
//     });

//     const emailInput = fieldset.querySelector('input[name="email"]');
//     emailInput.value = participant.email;
//     emailInput.addEventListener('input', (event) => {
//       participant.email = event.target.value;
//       clearFieldError(fieldset, 'email');
//     });

//     const aadhaarInput = fieldset.querySelector('input[name="aadhaar"]');
//     aadhaarInput.value = participant.aadhaar;
//     aadhaarInput.addEventListener('input', (event) => {
//       const filtered = event.target.value.replace(/\D/g, '').slice(0, 12);
//       event.target.value = filtered;
//       participant.aadhaar = filtered;
//       clearFieldError(fieldset, 'aadhaar');
//     });

//     participantsContainer.appendChild(fragment);
//   });
// }

// function validateParticipants() {
//   let valid = true;
//   state.participants.forEach((participant) => {
//     const fieldset = participantsContainer.querySelector(`fieldset[data-participant-id="${participant.id}"]`);
//     if (!fieldset) return;

//     const errors = {
//       fullName: '',
//       email: '',
//       aadhaar: '',
//     };

//     if (!participant.fullName.trim()) {
//       errors.fullName = 'Name is required';
//       valid = false;
//     }
//     if (!emailRegex.test(participant.email.trim())) {
//       errors.email = 'Enter a valid email address';
//       valid = false;
//     }
//     if (!aadhaarRegex.test(participant.aadhaar.trim())) {
//       errors.aadhaar = 'Provide a 12 digit Aadhaar number';
//       valid = false;
//     }

//     Object.entries(errors).forEach(([field, message]) => {
//       const target = fieldset.querySelector(`[data-error="${field}"]`);
//       if (target) {
//         target.textContent = message;
//       }
//     });
//   });
//   return valid;
// }

// function disableParticipantSubmit(disabled) {
//   const submitButton = participantsForm.querySelector('button.primary[type="submit"]');
//   if (submitButton) {
//     submitButton.disabled = disabled;
//     submitButton.textContent = disabled ? 'Saving…' : 'Save & Continue';
//   }
// }

// async function submitParticipants(event) {
//   event.preventDefault();

//   if (!state.upload) {
//     goToStep(0);
//     setUploadFeedback('Upload a PDF before continuing.', 'error');
//     return;
//   }

//   if (state.participants.length < 2) {
//     alert('At least two participants are required.');
//     return;
//   }

//   if (!validateParticipants()) {
//     return;
//   }

//   disableParticipantSubmit(true);

//   const payload = {
//     document: {
//       uploadId: state.upload.uploadId,
//       fileName: state.upload.fileName,
//     },
//     participants: state.participants.map((participant) => ({
//       fullName: participant.fullName.trim(),
//       email: participant.email.trim(),
//       aadhaar: participant.aadhaar.trim(),
//     })),
//   };

//   try {
//     const response = await fetch(`${API_BASE}/api/sessions`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//     });
//     const data = await response.json().catch(() => ({}));
//     if (!response.ok) {
//       throw new Error(data.error || 'Unable to create session');
//     }
//     state.session = data.session;
//     goToStep(2);
//     renderOtpStep();
//   } catch (error) {
//     alert(error.message || 'Unable to create session');
//   } finally {
//     disableParticipantSubmit(false);
//   }
// }

// function updateOtpCompletion() {
//   otpCompletionMessage.className = 'feedback';
//   if (!state.session || !state.session.participants) {
//     otpCompletionMessage.textContent = '';
//     return;
//   }
//   const total = state.session.participants.length;
//   const verified = state.session.participants.filter((participant) => participant.verified).length;
//   if (!verified) {
//     otpCompletionMessage.textContent = '';
//     return;
//   }
//   if (verified === total) {
//     otpCompletionMessage.textContent = 'All participants are verified. You can proceed with video signing and finalisation.';
//     otpCompletionMessage.classList.add('success');
//   } else {
//     otpCompletionMessage.textContent = `${verified} of ${total} participants verified.`;
//   }
// }

// async function handleSendOtp(participantId, statusElement, button) {
//   if (!state.session) return;
//   button.disabled = true;
//   statusElement.textContent = 'Sending…';
//   try {
//     const response = await fetch(`${API_BASE}/api/sessions/${state.session.id}/otp/${participantId}/send`, {
//       method: 'POST',
//     });
//     const data = await response.json().catch(() => ({}));
//     if (!response.ok) {
//       throw new Error(data.error || 'Unable to send OTP');
//     }
//     statusElement.textContent = 'OTP sent. Check the registered channels.';
//   } catch (error) {
//     statusElement.textContent = error.message || 'Unable to send OTP';
//   } finally {
//     button.disabled = false;
//   }
// }

// async function handleVerifyOtp(participantId, codeInput, statusElement, submitButton) {
//   if (!state.session) return;
//   const code = codeInput.value.trim();
//   if (!/^\d{6}$/.test(code)) {
//     statusElement.textContent = 'Enter the 6 digit code.';
//     return;
//   }

//   const participant = state.session.participants?.find((item) => item.id === participantId);
//   if (!participant) {
//     statusElement.textContent = 'Participant information unavailable.';
//     return;
//   }

//   submitButton.disabled = true;
//   codeInput.disabled = true;
//   statusElement.textContent = 'Verifying with Protean…';

//   let nextSession = null;
//   let success = false;

//   try {
//     const proteanResult = await verifyOtpWithProtean(participant, code);
//     if (!proteanResult.success) {
//       throw new Error(proteanResult.message || 'Protean verification failed');
//     }

//     statusElement.textContent = proteanResult.message || 'Authentication successful.';

//     const response = await fetch(`${API_BASE}/api/sessions/${state.session.id}/otp/${participantId}/verify`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ code }),
//     });
//     const data = await response.json().catch(() => ({}));
//     if (!response.ok || !data.session) {
//       throw new Error(data.error || 'Unable to verify OTP');
//     }
//     nextSession = data.session;
//     success = true;
//     statusElement.textContent = 'Authentication successful.';
//     codeInput.value = '';
//   } catch (error) {
//     statusElement.textContent = error.message || 'Unable to verify OTP';
//   } finally {
//     submitButton.disabled = false;
//     codeInput.disabled = false;
//     if (success && nextSession) {
//       state.session = nextSession;
//       updateOtpCompletion();
//       renderOtpStep();
//     }
//   }
// }

// function renderOtpStep() {
//   otpContainer.innerHTML = '';
//   if (!state.session || !state.session.participants) {
//     updateOtpCompletion();
//     return;
//   }

//   state.session.participants.forEach((participant) => {
//     const fragment = otpTemplate.content.cloneNode(true);
//     const card = fragment.querySelector('.otp-card');
//     card.dataset.participantId = participant.id;

//     const nameElement = fragment.querySelector('[data-name]');
//     const emailElement = fragment.querySelector('[data-email]');
//     const statusElement = fragment.querySelector('[data-status]');
//     const sendButton = fragment.querySelector('[data-action="send"]');
//     const verifyForm = fragment.querySelector('form[data-action="verify"]');
//     const codeInput = verifyForm.querySelector('input[name="code"]');
//     const submitButton = verifyForm.querySelector('button.primary');

//     nameElement.textContent = participant.fullName;
//     emailElement.textContent = participant.email;
//     statusElement.textContent = participant.verified ? 'Authentication successful.' : '';

//     sendButton.addEventListener('click', () => handleSendOtp(participant.id, statusElement, sendButton));
//     verifyForm.addEventListener('submit', (event) => {
//       event.preventDefault();
//       handleVerifyOtp(participant.id, codeInput, statusElement, submitButton);
//     });

//     if (participant.verified) {
//       sendButton.disabled = true;
//       codeInput.disabled = true;
//       submitButton.disabled = true;
//     }

//     otpContainer.appendChild(fragment);
//   });

//   updateOtpCompletion();
// }

// function initialiseUploadStep() {
// dropzone.addEventListener('click', (e) => {
//   // Prevent reopening while upload is in progress
//   if (uploadInProgress) return;

//   // Explicitly blur to stop focus loop
//   e.preventDefault();
//   fileInput.blur();

//   // Open picker manually
//   fileInput.click();
// });


//   dropzone.addEventListener('keydown', (event) => {
//     if (event.key === 'Enter' || event.key === ' ') {
//       event.preventDefault();
//       fileInput.click();
//     }
//   });

//   dropzone.addEventListener('dragover', (event) => {
//     event.preventDefault();
//     dropzone.classList.add('dragging');
//   });

//   dropzone.addEventListener('dragleave', () => {
//     dropzone.classList.remove('dragging');
//   });

//   dropzone.addEventListener('drop', (event) => {
//     event.preventDefault();
//     dropzone.classList.remove('dragging');
//     const [file] = event.dataTransfer.files || [];
//     if (file) {
//       processFile(file);
//     }
//   });

//   fileInput.addEventListener('change', (event) => {
//     const [file] = event.target.files || [];
//     if (file) {
//       processFile(file);
//     }
//   });

//   uploadNextButton.addEventListener('click', () => {
//     if (!state.upload) return;
//     goToStep(1);
//     const firstInput = participantsContainer.querySelector('input');
//     if (firstInput) {
//       firstInput.focus();
//     }
//   });
// }

// function initialiseParticipantsStep() {
//   addParticipantButton.addEventListener('click', () => {
//     const nextRole = `Participant ${state.participants.length + 1}`;
//     state.participants.push(createParticipant(nextRole));
//     renderParticipants();
//     const fieldset = participantsContainer.querySelector('fieldset:last-of-type input[name="fullName"]');
//     if (fieldset) {
//       fieldset.focus();
//     }
//   });

//   participantsForm.addEventListener('submit', submitParticipants);
// }

// function initialise() {
//   state.participants = [createParticipant('Signer'), createParticipant('Signer / Witness')];
//   renderParticipants();
//   initialiseUploadStep();
//   initialiseParticipantsStep();
//   goToStep(0);
// }

// initialise();
// window.addEventListener('DOMContentLoaded', () => {
//   recreateFileInput();
// });



// src/app.js
import './styles.css';

// --------------------------
// Global API configuration
// --------------------------
function determineApiBase() {
  const { hostname } = window.location;

  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return import.meta.env.VITE_API_BASE_DEV;
  }

  if (hostname.includes('uat.lawtribe.in')) {
    return import.meta.env.VITE_API_BASE_UAT;
  }

  return import.meta.env.VITE_API_BASE_PROD;
}

const API_BASE = determineApiBase();
console.info("🌐 Using API Base:", API_BASE);

// --------------------------
// State & Regex
// --------------------------
const state = { upload: null, participants: [], session: null };
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const aadhaarRegex = /^\d{12}$/;

// --------------------------
// DOM references
// --------------------------
const steps = Array.from(document.querySelectorAll('.step'));
const stepperItems = Array.from(document.querySelectorAll('#stepper-list li'));

const uploadFeedback = document.getElementById('upload-feedback');
const fileInput = document.getElementById('file-input');
const uploadNextButton = document.getElementById('upload-next');
const dropzone = document.querySelector('.dropzone');

const participantsForm = document.getElementById('participants-form');
const participantsContainer = document.getElementById('participants-container');
const addParticipantButton = document.getElementById('add-participant');
const participantTemplate = document.getElementById('participant-template');

const otpContainer = document.getElementById('otp-container');
const otpTemplate = document.getElementById('otp-template');
const otpCompletionMessage = document.getElementById('otp-completion');

let currentStep = 0;
let uploadInProgress = false;

// --------------------------
// Helper functions
// --------------------------
function goToStep(index) {
  currentStep = index;
  steps.forEach((step, idx) => step.classList.toggle('active', idx === index));
  stepperItems.forEach((item, idx) => {
    item.classList.toggle('active', idx === index);
    item.classList.toggle('complete', idx < index);
  });
}

function randomId() {
  return window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}

function createParticipant(role) {
  return { id: randomId(), role, fullName: '', email: '', aadhaar: '' };
}

function setUploadFeedback(message, variant = 'info') {
  uploadFeedback.textContent = message;
  uploadFeedback.className = `feedback ${variant}`;
}

function resetOtpStep() {
  state.session = null;
  otpContainer.innerHTML = '';
  otpCompletionMessage.textContent = '';
  otpCompletionMessage.className = 'feedback';
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      base64 ? resolve(base64) : reject(new Error('Failed to encode file'));
    };
    reader.readAsDataURL(file);
  });
}

// --------------------------
// File Upload
// --------------------------
async function processFile(file) {
  if (uploadInProgress || !file) return;
  uploadInProgress = true;

  if (file.type !== 'application/pdf') {
    setUploadFeedback('Please upload a PDF document.', 'error');
    uploadInProgress = false;
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    setUploadFeedback('The PDF must be smaller than 10 MB.', 'error');
    uploadInProgress = false;
    return;
  }

  setUploadFeedback(`Uploading ${file.name}…`);
  uploadNextButton.disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    const response = await fetch(`${API_BASE}/api/uploads`, { method: 'POST', body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Upload failed');

    state.upload = payload;
    setUploadFeedback(`Uploaded ${payload.fileName}. Continue to participants.`, 'success');
    resetOtpStep();
  } catch (err) {
    console.error('❌ Upload error:', err);
    state.upload = null;
    setUploadFeedback(err.message || 'Upload failed', 'error');
  } finally {
    uploadNextButton.disabled = !state.upload;
    uploadInProgress = false;
    recreateFileInput();
  }
}

function recreateFileInput() {
  const oldInput = document.getElementById('file-input');
  const newInput = oldInput.cloneNode(true);
  oldInput.replaceWith(newInput);
  newInput.addEventListener('change', (e) => {
    const [file] = e.target.files;
    if (file) processFile(file);
  });
}

// --------------------------
// Participants
// --------------------------
function clearFieldError(fieldset, field) {
  const target = fieldset.querySelector(`[data-error="${field}"]`);
  if (target) target.textContent = '';
}

function renderParticipants() {
  participantsContainer.innerHTML = '';
  state.participants.forEach((participant, index) => {
    const fragment = participantTemplate.content.cloneNode(true);
    const fieldset = fragment.querySelector('fieldset');
    fieldset.dataset.participantId = participant.id;

    fragment.querySelector('[data-role]').textContent = participant.role || `Participant ${index + 1}`;

    const fullNameInput = fieldset.querySelector('input[name="fullName"]');
    fullNameInput.value = participant.fullName;
    fullNameInput.addEventListener('input', (e) => {
      participant.fullName = e.target.value;
      clearFieldError(fieldset, 'fullName');
    });

    const emailInput = fieldset.querySelector('input[name="email"]');
    emailInput.value = participant.email;
    emailInput.addEventListener('input', (e) => {
      participant.email = e.target.value;
      clearFieldError(fieldset, 'email');
    });

    const aadhaarInput = fieldset.querySelector('input[name="aadhaar"]');
    aadhaarInput.value = participant.aadhaar;
    aadhaarInput.addEventListener('input', (e) => {
      const filtered = e.target.value.replace(/\D/g, '').slice(0, 12);
      e.target.value = filtered;
      participant.aadhaar = filtered;
      clearFieldError(fieldset, 'aadhaar');
    });

    participantsContainer.appendChild(fragment);
  });
}

// --------------------------
// Upload Step
// --------------------------
function initialiseUploadStep() {
  dropzone.addEventListener('click', (e) => {
    if (uploadInProgress) return;
    e.preventDefault();
    fileInput.blur();
    fileInput.click();
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    const [file] = e.dataTransfer.files || [];
    if (file) processFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const [file] = e.target.files || [];
    if (file) processFile(file);
  });

  uploadNextButton.addEventListener('click', () => {
    if (!state.upload) return;
    goToStep(1);
    const firstInput = participantsContainer.querySelector('input');
    if (firstInput) firstInput.focus();
  });
}

// --------------------------
// Participants Step
// --------------------------
function initialiseParticipantsStep() {
  addParticipantButton.addEventListener('click', () => {
    const nextRole = `Participant ${state.participants.length + 1}`;
    state.participants.push(createParticipant(nextRole));
    renderParticipants();
    const fieldset = participantsContainer.querySelector('fieldset:last-of-type input[name="fullName"]');
    if (fieldset) fieldset.focus();
  });

  participantsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.upload) {
      goToStep(0);
      setUploadFeedback('Upload a PDF before continuing.', 'error');
      return;
    }

    if (state.participants.length < 2) {
      alert('At least two participants are required.');
      return;
    }

    // Validate participants
    let valid = true;
    state.participants.forEach((p) => {
      const fs = participantsContainer.querySelector(`fieldset[data-participant-id="${p.id}"]`);
      if (!fs) return;

      if (!p.fullName.trim()) {
        fs.querySelector('[data-error="fullName"]').textContent = 'Name is required';
        valid = false;
      }
      if (!emailRegex.test(p.email.trim())) {
        fs.querySelector('[data-error="email"]').textContent = 'Enter a valid email address';
        valid = false;
      }
      if (!aadhaarRegex.test(p.aadhaar.trim())) {
        fs.querySelector('[data-error="aadhaar"]').textContent = 'Provide a 12 digit Aadhaar number';
        valid = false;
      }
    });

    if (!valid) return;

    const payload = {
      document: { uploadId: state.upload.uploadId, fileName: state.upload.fileName },
      participants: state.participants.map((p) => ({
        fullName: p.fullName.trim(),
        email: p.email.trim(),
        aadhaar: p.aadhaar.trim(),
      })),
    };

    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to create session');

      state.session = data.session;
      goToStep(2);
      renderOtpStep();
    } catch (err) {
      alert(err.message || 'Unable to create session');
    }
  });
}

// --------------------------
// OTP Step
// --------------------------
function updateOtpCompletion() {
  otpCompletionMessage.className = 'feedback';
  if (!state.session || !state.session.participants) return;

  const total = state.session.participants.length;
  const verified = state.session.participants.filter((p) => p.verified).length;

  if (!verified) return;

  if (verified === total) {
    otpCompletionMessage.textContent = 'All participants verified. Proceed to finalisation.';
    otpCompletionMessage.classList.add('success');
  } else {
    otpCompletionMessage.textContent = `${verified} of ${total} participants verified.`;
  }
}

function renderOtpStep() {
  otpContainer.innerHTML = '';
  if (!state.session || !state.session.participants) return updateOtpCompletion();

  state.session.participants.forEach((p) => {
    const fragment = otpTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.otp-card');
    card.dataset.participantId = p.id;

    const nameEl = fragment.querySelector('[data-name]');
    const emailEl = fragment.querySelector('[data-email]');
    const statusEl = fragment.querySelector('[data-status]');
    const sendBtn = fragment.querySelector('[data-action="send"]');
    const verifyForm = fragment.querySelector('form[data-action="verify"]');
    const codeInput = verifyForm.querySelector('input[name="code"]');
    const submitBtn = verifyForm.querySelector('button.primary');

    nameEl.textContent = p.fullName;
    emailEl.textContent = p.email;
    statusEl.textContent = p.verified ? 'Authentication successful.' : '';

    sendBtn.addEventListener('click', async () => {
      if (!state.session) return;
      sendBtn.disabled = true;
      statusEl.textContent = 'Sending…';
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${state.session.id}/otp/${p.id}/send`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Unable to send OTP');
        statusEl.textContent = 'OTP sent. Check the registered channels.';
      } catch (err) {
        statusEl.textContent = err.message || 'Unable to send OTP';
      } finally {
        sendBtn.disabled = false;
      }
    });

    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.session) return;

      const code = codeInput.value.trim();
      if (!/^\d{6}$/.test(code)) {
        statusEl.textContent = 'Enter the 6 digit code.';
        return;
      }

      submitBtn.disabled = true;
      codeInput.disabled = true;
      statusEl.textContent = 'Verifying…';

      try {
        // Fake verification for demo
        const success = code === '123456';
        if (!success) throw new Error('Invalid OTP. Use 123456 for testing.');

        statusEl.textContent = 'Authentication successful.';
        p.verified = true;
        updateOtpCompletion();
      } catch (err) {
        statusEl.textContent = err.message || 'Unable to verify OTP';
      } finally {
        submitBtn.disabled = false;
        codeInput.disabled = false;
        codeInput.value = '';
      }
    });

    if (p.verified) {
      sendBtn.disabled = true;
      codeInput.disabled = true;
      submitBtn.disabled = true;
    }

    otpContainer.appendChild(fragment);
  });
}

// --------------------------
// Initialise app
// --------------------------
function initialise() {
  state.participants = [createParticipant('Signer'), createParticipant('Signer / Witness')];
  renderParticipants();
  initialiseUploadStep();
  initialiseParticipantsStep();
  goToStep(0);
}

initialise();
window.addEventListener('DOMContentLoaded', () => recreateFileInput());

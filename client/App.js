import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const emailRegex =
  /^(?:[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\"]|\\\")+")@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function createParticipant(role, overrides = {}) {
  return { id: Math.random().toString(36).slice(2), role, fullName: '', email: '', aadhaar: '', ...overrides };
}

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [upload, setUpload] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [participants, setParticipants] = useState([
    createParticipant('Signer'),
    createParticipant('Signer / Witness'),
  ]);
  const [session, setSession] = useState(null);
  const [otpStatus, setOtpStatus] = useState({});
  const [otpInputs, setOtpInputs] = useState({});
  const [signatureInputs, setSignatureInputs] = useState({});
  const [finaliseStatus, setFinaliseStatus] = useState('');
  const steps = useMemo(
    () => [
      { title: 'Upload Document' },
      { title: 'Participants' },
      { title: 'OTP Verification' },
      { title: 'Video & Signatures' },
      { title: 'Finalize Evidence' },
    ],
    []
  );

  const updateParticipant = (id, key, value) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  };

  const addParticipant = () => {
    setParticipants((prev) => [...prev, createParticipant(`Participant ${prev.length + 1}`)]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.type !== 'success') return;

    setUploadStatus('Uploading…');
    try {
      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: result.name, content: base64 }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(payload.error || 'Upload failed');
      }
      const payload = await response.json();
      setUpload(payload);
      setUploadStatus('Upload complete. Continue to participants.');
      setCurrentStep(1);
    } catch (error) {
      setUploadStatus(error.message);
      Alert.alert('Upload error', error.message);
    }
  };

  const submitParticipants = async () => {
    const errors = {};
    const cleanParticipants = participants.map((p) => ({
      ...p,
      fullName: p.fullName.trim(),
      email: p.email.trim(),
      aadhaar: p.aadhaar.trim(),
    }));

    cleanParticipants.forEach((participant) => {
      const localErrors = [];
      if (!participant.fullName) localErrors.push('Name required');
      if (!emailRegex.test(participant.email)) localErrors.push('Valid email required');
      if (!/^\d{12}$/.test(participant.aadhaar)) localErrors.push('Aadhaar must be 12 digits');
      if (localErrors.length) errors[participant.id] = localErrors.join(', ');
    });

    if (Object.keys(errors).length) {
      Alert.alert('Fix participant details', Object.values(errors).join('\n'));
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: { uploadId: upload.uploadId, fileName: upload.fileName },
          participants: cleanParticipants.map(({ fullName, email, aadhaar }) => ({ fullName, email, aadhaar })),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to create session' }));
        throw new Error(payload.error || 'Unable to create session');
      }
      const payload = await response.json();
      setSession(payload.session);
      setOtpStatus({});
      setOtpInputs({});
      setCurrentStep(2);
    } catch (error) {
      Alert.alert('Session error', error.message);
    }
  };

  const sendOtp = async (participantId) => {
    if (!session) return;
    setOtpStatus((prev) => ({ ...prev, [participantId]: 'Dispatching…' }));
    try {
      const response = await fetch(
        `${API_BASE}/api/sessions/${session.id}/otp/${participantId}/send`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to send OTP' }));
        throw new Error(payload.error || 'Unable to send OTP');
      }
      setOtpStatus((prev) => ({ ...prev, [participantId]: 'OTP sent. Check channels.' }));
    } catch (error) {
      setOtpStatus((prev) => ({ ...prev, [participantId]: error.message }));
      Alert.alert('OTP error', error.message);
    }
  };

  const verifyOtp = async (participantId) => {
    if (!session) return;
    const code = otpInputs[participantId];
    if (!code) {
      Alert.alert('OTP required', 'Enter the received OTP code.');
      return;
    }
    setOtpStatus((prev) => ({ ...prev, [participantId]: 'Verifying…' }));
    try {
      const response = await fetch(
        `${API_BASE}/api/sessions/${session.id}/otp/${participantId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to verify');
      }
      setSession(payload.session);
      setOtpStatus((prev) => ({ ...prev, [participantId]: 'Verified' }));
    } catch (error) {
      setOtpStatus((prev) => ({ ...prev, [participantId]: error.message }));
      Alert.alert('Verification failed', error.message);
    }
  };

  const issueVideoToken = async () => {
    if (!session) return;
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${session.id}/video`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to issue token' }));
        throw new Error(payload.error || 'Unable to issue token');
      }
      const payload = await response.json();
      setSession((prev) => ({
        ...prev,
        videoSession: { roomId: payload.roomId, token: payload.token },
      }));
      Alert.alert('Video token issued', `Room ${payload.roomId}`);
    } catch (error) {
      Alert.alert('Video token error', error.message);
    }
  };

  const updateSignatureInput = (participantId, key, value) => {
    setSignatureInputs((prev) => ({
      ...prev,
      [participantId]: { ...prev[participantId], [key]: value },
    }));
  };

  const submitSignature = async (participantId) => {
    if (!session) return;
    const input = signatureInputs[participantId] || {};
    const { dataUrl, page = '1', position = '' } = input;
    if (!dataUrl) {
      Alert.alert('Signature required', 'Provide a data URL or upload placeholder.');
      return;
    }
    let parsedPosition;
    try {
      parsedPosition = position ? JSON.parse(position) : undefined;
    } catch (error) {
      Alert.alert('Invalid position', 'Position must be valid JSON.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${session.id}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          type: 'drawn',
          dataUrl,
          page: Number(page) || 1,
          position: parsedPosition,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to store signature');
      }
      setSession(payload.session);
      Alert.alert('Signature stored', 'Signature uploaded successfully.');
    } catch (error) {
      Alert.alert('Signature error', error.message);
    }
  };

  const finaliseSession = async () => {
    if (!session) return;
    setFinaliseStatus('Generating evidence…');
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${session.id}/finalize`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Finalisation failed' }));
        throw new Error(payload.error || 'Finalisation failed');
      }
      const payload = await response.json();
      setFinaliseStatus(
        `Success. Hash ${payload.hash}. Certificate JSON: ${payload.certificate.json}. PDF: ${payload.certificate.pdf}`
      );
      Alert.alert('Session finalised', 'Evidence package generated.');
    } catch (error) {
      setFinaliseStatus(error.message);
      Alert.alert('Finalisation error', error.message);
    }
  };

  const allOtpVerified = session?.participants?.every((participant) => participant.verified);
  const allSigned = session?.participants?.every((participant) => participant.signature);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.card}>
            <Text style={styles.heading}>Upload notarised document (PDF)</Text>
            <Button title="Select PDF" onPress={pickDocument} />
            {!!upload && (
              <Text style={styles.meta}>Uploaded: {upload.fileName}</Text>
            )}
            {!!uploadStatus && <Text style={styles.status}>{uploadStatus}</Text>}
          </View>
        );
      case 1:
        return (
          <View style={styles.card}>
            <Text style={styles.heading}>Enter participants</Text>
            {participants.map((participant, index) => (
              <View key={participant.id} style={styles.participantCard}>
                <Text style={styles.meta}>{participant.role || `Participant ${index + 1}`}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={participant.fullName}
                  onChangeText={(value) => updateParticipant(participant.id, 'fullName', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={participant.email}
                  onChangeText={(value) => updateParticipant(participant.id, 'email', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Aadhaar (12 digits)"
                  keyboardType="number-pad"
                  value={participant.aadhaar}
                  onChangeText={(value) => updateParticipant(participant.id, 'aadhaar', value.replace(/[^0-9]/g, ''))}
                  maxLength={12}
                />
                {participants.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeParticipant(participant.id)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <Button title="Add participant" onPress={addParticipant} />
            <View style={styles.actions}>
              <Button title="Back" onPress={() => setCurrentStep(0)} />
              <Button
                title="Continue"
                onPress={submitParticipants}
                disabled={!upload}
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.card}>
            <Text style={styles.heading}>OTP Verification</Text>
            {session?.participants?.map((participant) => (
              <View key={participant.id} style={styles.participantCard}>
                <Text style={styles.meta}>{participant.fullName}</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="Enter OTP"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpInputs[participant.id] || ''}
                    onChangeText={(value) =>
                      setOtpInputs((prev) => ({ ...prev, [participant.id]: value.replace(/[^0-9]/g, '') }))
                    }
                  />
                  <View style={styles.rowButton}>
                    <Button title="Send" onPress={() => sendOtp(participant.id)} />
                  </View>
                  <View style={styles.rowButton}>
                    <Button title="Verify" onPress={() => verifyOtp(participant.id)} />
                  </View>
                </View>
                <Text style={styles.status}>{otpStatus[participant.id] || (participant.verified ? 'Verified' : '')}</Text>
              </View>
            ))}
            <View style={styles.actions}>
              <Button title="Back" onPress={() => setCurrentStep(1)} />
              <Button
                title="Continue"
                onPress={() => setCurrentStep(3)}
                disabled={!allOtpVerified}
              />
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.card}>
            <Text style={styles.heading}>Video session & signatures</Text>
            <Button title="Issue video room" onPress={issueVideoToken} disabled={!allOtpVerified} />
            {session?.videoSession?.token && (
              <Text style={styles.meta}>
                Room {session.videoSession.roomId}. Token {session.videoSession.token.slice(0, 16)}…
              </Text>
            )}
            <View style={styles.divider} />
            {session?.participants?.map((participant) => (
              <View key={participant.id} style={styles.participantCard}>
                <Text style={styles.meta}>{participant.fullName}</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Signature data URL"
                  multiline
                  value={signatureInputs[participant.id]?.dataUrl || ''}
                  onChangeText={(value) => updateSignatureInput(participant.id, 'dataUrl', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Page number"
                  keyboardType="number-pad"
                  value={signatureInputs[participant.id]?.page || ''}
                  onChangeText={(value) => updateSignatureInput(participant.id, 'page', value.replace(/[^0-9]/g, ''))}
                />
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder='Position JSON e.g. {"x":100,"y":200,"width":150,"height":50}'
                  multiline
                  value={signatureInputs[participant.id]?.position || ''}
                  onChangeText={(value) => updateSignatureInput(participant.id, 'position', value)}
                />
                <Button title="Submit signature" onPress={() => submitSignature(participant.id)} />
                <Text style={styles.status}>
                  {participant.signature
                    ? `Signed at ${participant.signature.signedAt}`
                    : 'Pending signature'}
                </Text>
              </View>
            ))}
            <View style={styles.actions}>
              <Button title="Back" onPress={() => setCurrentStep(2)} />
              <Button
                title="Continue"
                onPress={() => setCurrentStep(4)}
                disabled={!allSigned}
              />
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.card}>
            <Text style={styles.heading}>Generate evidence package</Text>
            <Text style={styles.meta}>
              {session?.participants?.map((participant) =>
                `${participant.fullName}: ${participant.signature ? 'Signed' : 'Pending'}`
              ).join('\n')}
            </Text>
            <Button title="Finalize" onPress={finaliseSession} disabled={!allSigned} />
            {!!finaliseStatus && <Text style={styles.status}>{finaliseStatus}</Text>}
            <View style={styles.actions}>
              <Button title="Back" onPress={() => setCurrentStep(3)} />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>E-Notary Workflow</Text>
        <View style={styles.stepper}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View
                style={[
                  styles.stepIndicator,
                  index === currentStep ? styles.stepIndicatorActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    index === currentStep ? styles.stepNumberActive : null,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.stepLabel}>{step.title}</Text>
            </View>
          ))}
        </View>
        {renderStepContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 16,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  step: {
    alignItems: 'center',
    width: '19%',
    minWidth: 120,
    marginBottom: 12,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepIndicatorActive: {
    backgroundColor: '#38bdf8',
  },
  stepNumber: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  stepNumberActive: {
    color: '#0f172a',
  },
  stepLabel: {
    color: '#e2e8f0',
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  meta: {
    color: '#cbd5f5',
    marginVertical: 4,
  },
  status: {
    color: '#facc15',
    marginTop: 4,
  },
  participantCard: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  otpInput: {
    flex: 1,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowButton: {
    marginLeft: 8,
  },
  divider: {
    borderBottomColor: '#334155',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  removeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#7f1d1d',
  },
  removeButtonText: {
    color: '#fee2e2',
    fontWeight: '600',
  },
});

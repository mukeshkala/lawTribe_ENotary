# LawTribe E-Notary

A reference implementation for running a secure remote notarisation workflow. The system includes a Node.js evidence service and a React Native (Expo) client that guides users through document intake, participant verification, OTP challenges, video session token issuance, signature capture, and evidence generation.

## Features

- **Document intake** – upload PDFs via the API, store on disk, and expose preview metadata to the client.
- **Participant registry** – capture full name, email and Aadhaar details with inline validation.
- **OTP verification** – generate six digit codes with five-minute TTL, enforce retry throttling and lockout after repeated failures.
- **Video session provisioning** – issue signed JSON web tokens to guard meeting access once every participant is verified.
- **Signature capture** – record drawn signatures with contextual metadata (page, bounding box, timestamp, participant ID).
- **Audit evidence** – build a tamper-evident hash chain, compute a SHA-256 digest of the final PDF, and output JSON plus PDF certificates.

## Project layout

```
├── client          # React Native (Expo) mobile experience
│   ├── App.js
│   ├── app.json
│   ├── babel.config.js
│   └── package.json
├── server          # Node.js API & evidence services
│   ├── index.js
│   ├── data/
│   ├── uploads/
│   └── certificates/
└── readme.md
```

## Running locally

### Start the API

The backend avoids external dependencies so it can boot on a vanilla Node.js 18+ runtime.

```bash
cd server
node index.js
```

The API listens on [http://localhost:4000](http://localhost:4000) by default.

### Launch the React Native client

The mobile client is configured as an Expo application. Install dependencies and start the Metro bundler from the `client` directory:

```bash
cd client
npm install
npm run start
```

Scan the QR code with the Expo Go app (or use an emulator) to open the workflow. The client reads the API origin from `EXPO_PUBLIC_API_BASE_URL`.

#### Client environment variables

Set the API origin for native devices (the value must be reachable from your simulator or physical device).

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:4000 expo start
```

### Server environment variables

| Name         | Description                                           | Default                          |
| ------------ | ----------------------------------------------------- | -------------------------------- |
| `PORT`       | HTTP port for the server                              | `4000`                           |
| `JWT_SECRET` | Secret used when minting video session tokens         | `development-secret-change-me`   |

## Data persistence

- Session metadata is stored as JSON at `server/data/sessions.json`.
- Uploaded PDFs and generated previews live under `server/uploads/`.
- Evidence artefacts (JSON + minimal PDF) are saved to `server/certificates/`.

## Security considerations

This project focuses on business logic; production deployments must integrate hardened storage, encrypted communications, and replace stubbed services (email/SMS delivery, S3 storage, and PDF flattening) with audited providers.

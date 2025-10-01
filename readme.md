# LawTribe E-Notary

A lightweight, production-ready reference implementation for running a secure remote notarisation workflow. The stack is intentionally dependency-free to run in constrained environments while demonstrating core flows: document intake, participant verification, OTP challenges, video session authorisation, signature capture, and evidence generation.

## Features

- **Document intake** – upload PDFs directly to the node server, store on disk, and expose preview metadata to the client.
- **Participant registry** – capture full name, email and Aadhaar details with inline accessibility-friendly validation.
- **OTP verification** – generate six digit codes with five-minute TTL, enforce retry throttling and lockout after repeated failures.
- **Video session provisioning** – issue signed JSON web tokens to guard meeting access once every participant is verified.
- **Signature capture** – record drawn signatures with contextual metadata (page, bounding box, timestamp, participant ID).
- **Audit evidence** – build a tamper-evident hash chain, compute a SHA-256 digest of the final PDF, and output JSON plus PDF certificates.

## Project layout

```
├── client          # Static front-end experience
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server          # Node.js API & evidence services
│   ├── index.js
│   ├── data/
│   ├── uploads/
│   └── certificates/
└── readme.md
```

## Running locally

The stack avoids npm dependencies so that it can boot on a vanilla Node.js 18+ runtime.

```bash
# Start the API + static asset server
cd server
node index.js
```

Navigate to [http://localhost:4000](http://localhost:4000) to launch the client.

## Environment variables

| Name        | Description                                                   | Default                      |
| ----------- | ------------------------------------------------------------- | ---------------------------- |
| `PORT`      | HTTP port for the server                                      | `4000`                       |
| `JWT_SECRET`| Secret used when minting video session tokens                 | `development-secret-change-me` |

## Data persistence

- Session metadata is stored as JSON at `server/data/sessions.json`.
- Uploaded PDFs and generated previews live under `server/uploads/`.
- Evidence artefacts (JSON + minimal PDF) are saved to `server/certificates/`.

## Security considerations

This project focuses on business logic; production deployments must integrate hardened storage, encrypted communications, and replace stubbed services (email/SMS delivery, S3 storage, and PDF flattening) with audited providers.

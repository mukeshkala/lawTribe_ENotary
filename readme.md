# Modern Notarization Platform – Implementation Prompt

## Overview
This repository captures the full, production-ready specification for building a secure and accessible digital notarization platform. The prompt below is intended for use with a code generator or as a master product brief for engineering teams.

---

# Build a Modern Notarization Platform (Full Stack, Prod-Ready)

## Objective
Implement a secure, accessible, and scalable web application that streamlines digital notarization for legal practitioners—covering document intake, identity/OTP verification, multi-party video session, e-signature on PDF, and audit trail.

## Non-Goals
- No marketing site or CMS.
- No payment gateway (stub interface only).

## Tech Stack (Opinionated & Practical)
- **Frontend:** React (TypeScript) + Vite (or Next.js) with dark/light themes; Tailwind CSS; React Router; React Query; accessible UI components (e.g., Radix UI or Headless UI).
- **Video:** WebRTC via AWS Chime SDK (preferred) or vanilla WebRTC with TURN (coturn).
- **E-Signature:** PDF rendering with pdf.js + canvas overlay; signature pad (e.g., perfect-freehand or signature_pad); draw + place + undo; supports stylus.
- **Backend:** Node.js (TypeScript) + Express (or Fastify).
- **Auth:** JWT (short-lived access + refresh), optional SSO hook; per-session CSRF defense for web.
- **Database:** MongoDB (Mongoose) for users, notarization sessions, signatures, OTP logs, and audit trail.
- **Object Storage:** Amazon S3 + **presigned URLs** for upload/download; **do not** store docs on EC2.
- **Email/SMS:** AWS SES for email OTP; AWS SNS or Twilio for SMS OTP (pluggable).
- **Infra:** API Gateway (optional), ECS/Fargate or EKS for app, CloudFront for static assets, WAF, Secrets Manager for secrets, CloudWatch for logs/metrics.
- **Security:** TLS everywhere; encryption at rest (S3 SSE-S3/KMS; MongoDB encrypted volumes); field-level encryption for Aadhaar and PII; rate limiting; IP throttling; audit logging; tamper-evident hashes.

> If you must target mobile first, keep this stack and wrap the web app in Capacitor. (React Native is possible but complicates pdf.js/WebRTC; prefer web React for this use case.)

## Core Workflow (User Journey)
1. **Document Upload**
   - Drag-and-drop (PDF, DOCX), render live preview (convert DOCX→PDF server-side for signing).
   - Virus scan stub + MIME/type/size checks.
   - Upload flows use S3 presigned URLs; show progress and graceful retries.
2. **Parties & Identity Input**
   - Interactive stepper (2 or 3 parties).
   - For each participant: full name (required), email (RFC 5322), **Aadhaar** number (12 digits; numeric; never logged in plain text).
   - Real-time validation with accessible inline errors.
3. **OTP Challenge**
   - Generate per-party OTP (6 digits, TOTP-like or random; 5-minute TTL).
   - Send via SES (email) and optionally SMS.
   - Show delivery status; throttle requests; lock after N failed attempts.
   - Masked inputs; do not echo codes in logs.
4. **Video & E-Signature Session**
   - Split-screen: left = document preview/signing; right = multi-party video.
   - Only **verified** participants may join session room (JWT + session token).
   - Apply signatures by drawing or uploading an image; allow placement on specific pages; capture timestamp + page + bounding box + user id.
   - Maintain progress indicators for pending/completed signatures.
5. **Finalize & Evidence**
   - Flatten signatures into the PDF (server-side) and produce **hash (SHA-256)**.
   - Generate an **Audit Certificate** (JSON + human-readable PDF) containing: document hash, participant emails (masked), signedAt timestamps (UTC), IPs (truncated), video session id, OTP result, and a tamper-evident log hash chain.
   - Store final PDF and certificate in S3; persist metadata in MongoDB.

## Accessibility
- Keyboard navigation, visible focus, ARIA labels, reduced motion preferences, high-contrast mode.

## Data Models (Mongoose, TypeScript)
Define schemas for:
- **User**: `{ _id, name, email, roles, createdAt }`
- **NotarizationSession**: `{ _id, status['DRAFT'|'VERIFYING'|'IN_PROGRESS'|'SIGNED'|'CLOSED'], document:{s3Key, originalName, mime, size, sha256}, parties:[{name,email,aadhaarEnc,lastOtpAttemptAt,verifiedAt}], video:{provider, roomId}, audit:{events:[{ts,type,by,meta}], chainHead}, createdBy, createdAt, updatedAt }`
- **OtpLog**: `{ sessionId, partyEmail, otpHash, expiresAt, attempts, deliveredVia, createdAt }`
- **Signature**: `{ sessionId, partyEmail, page, bbox:{x,y,w,h}, inkSvg|pngBlobRef, signedAt }`

## REST API (OpenAPI-style)
Create endpoints with DTO validation (zod or class-validator). Return 4xx/5xx with structured error bodies.

**Auth**
- `POST /auth/register` (admin only in real deployments)
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

**Documents**
- `POST /docs/presign-upload` → `{ url, fields, s3Key, maxSize }`
- `POST /docs/ingest` (optional DOCX→PDF conversion) → `{ pdfS3Key, sha256 }`

**Sessions**
- `POST /sessions` → create notarization session
- `GET /sessions/:id`
- `PATCH /sessions/:id` → update parties, status transitions via server-side state machine
- `POST /sessions/:id/otp/send` → per party `{email, channel}`
- `POST /sessions/:id/otp/verify` → `{email, otp}` → marks party verified
- `POST /sessions/:id/video/join` → returns Chime join info or WebRTC SDP
- `POST /sessions/:id/signatures` → add signature metadata
- `POST /sessions/:id/finalize` → flattens signatures into PDF, computes sha256, writes audit cert, moves status → `SIGNED`
- `GET  /sessions/:id/certificate` → download audit certificate
- `GET  /sessions/:id/download` → presigned URL for final PDF

**Admin/Compliance**
- `GET /admin/audit/:id` → paginated audit log
- `POST /admin/revoke/:id` → revoke session (append-only log)

## Security & Compliance Requirements
- Validate/escape all inputs; centralized error handler.
- **Never** log Aadhaar or OTP in plaintext; store Aadhaar encrypted (field-level) and render only masked (e.g., `XXXX-XXXX-1234`).
- OTP rate limits per email/IP; lockout policy with exponential backoff.
- JWT rotation; set `SameSite=strict` and `HttpOnly` where cookies are used.
- CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers.
- S3 presigned URLs with minimal scope and short TTL.
- Generate SHA-256 hashes for originals and finals; include in audit certificate.
- WAF rules against common attacks; dependency scanning (npm audit, OWASP).
- Pseudonymize IPs in logs; configurable retention.
- **India context:** treat Aadhaar as sensitive; do not attempt Aadhaar e-KYC; if required, integrate approved eSign providers separately (stub interface in code).

## Frontend Requirements
- Stepper wizard with inline validation and i18n ready (en as default).
- Reusable components: `FileDropzone`, `PartyForm`, `OtpEntry`, `VideoPanel`, `PdfSigner`, `ProgressStrip`, `Toast`.
- State: React Query for server state; Context or Zustand for UI state.
- Theming: Tailwind + CSS variables; dark/light toggle saved to localStorage.
- Real-time UX: optimistic updates, spinners, snackbars, retry buttons.
- Full keyboard flow; screen reader labels; focus management on modals.

## DevX & Project Structure
```
/app
  /frontend
    /src
      /components
      /features
        /upload
        /parties
        /otp
        /video
        /signing
        /session
      /lib (api client, validators)
      /styles
      main.tsx
  /backend
    /src
      /config
      /routes
      /controllers
      /services (otp, mail, sms, video, pdf, storage, audit)
      /models
      /middleware (auth, rate-limit, error-handler, cors, csp)
      /utils (hashing, crypto, presign)
      server.ts
  /infra
    /terraform (S3, IAM, SES/SNS, Chime, WAF)
    /docker
  .env.example
  README.md
```

## Testing & Quality
- Unit tests (Jest) for services and validators.
- API tests (Supertest) for all endpoints.
- E2E flow test (Playwright) covering upload → verify → video join → sign → finalize.
- Linting (ESLint), formatting (Prettier), type-safety (strict TS).
- GitHub Actions: build, test, security scan, container image, deploy.

## Deliverables
1. Full source code (frontend + backend) with clear comments.
2. OpenAPI (YAML/JSON) for all endpoints.
3. Infrastructure as code (Terraform) samples for S3, IAM roles, SES/SNS, Chime.
4. Seed scripts and mock data for local dev.
5. README with setup, `.env.example`, and “happy path” run steps.
6. Sample **Audit Certificate** output (JSON + PDF) and a sample signed PDF.

## Acceptance Criteria
- Upload, preview, and convert docs; S3 presigned uploads work.
- Parties validated; OTPs delivered; verification rules enforced.
- Only verified users can join video and sign.
- Signatures are placed, saved, and **flattened server-side**; final PDF hash recorded.
- Audit certificate generated with tamper-evident chain.
- Accessibility checks pass (axe) and basic WAI-ARIA patterns verified.
- All tests pass; CI pipeline green.

## Notes for the Code Generator
- Prefer composition over inheritance; keep services pure/testable.
- Isolate third-party SDKs (SES/SNS/Chime/S3) behind interfaces to allow mocking.
- Centralize validation with zod or class-validator shared across FE/BE (via DTOs).
- Do not hardcode secrets; read from env; provide `.env.example`.

---

### Why These Fixes?
- **Storage on EC2 → S3:** EC2 isn’t a document store; S3 + presigned URLs is the secure, standard approach.
- **React Native → Web React:** notarization needs pdf.js and robust WebRTC—dramatically simpler and more stable on the web stack.
- **Security & Compliance:** Adds encryption, hashing, WAF, rate limits, and audit trails that a real notarization flow requires.
- **Code-gen Ready:** Concrete endpoints, models, folder structure, and acceptance criteria help a generator output consistent, maintainable code.

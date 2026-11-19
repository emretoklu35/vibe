# VIBE — Master Product & Engineering Brief

> Original brief, kept as-is for reference. Open questions and review notes live in [ACIK-KARARLAR.md](ACIK-KARARLAR.md).

## 1. Project Overview

We are building VIBE, a premium, AI-assisted social discovery and dating mobile application for iOS and Android.

Tagline: More than a match. Real chemistry.

VIBE is not intended to be a simple Tinder or Bumble clone. Its goal is to help people build meaningful connections based on lifestyle, interests, communication preferences and relationship expectations, and then turn those connections into real-life experiences.

The initial target market is Turkey, with an architecture designed to support international expansion, especially Europe.

The application is intended for adults aged 18 and above.

## 2. Core Product Features

1. AI Matchmaker: conversational onboarding, preference understanding and transparent compatibility explanations.
2. Discover: discover, like and pass on profiles.
3. Matching: create a match when two users mutually like each other.
4. Chat: real-time messaging between matched users.
5. Voice Profile: optional short audio introductions.
6. Chemistry Games: interactive questions and conversation starters.
7. Double Date: two-person groups that can connect with another two-person group.
8. Date Planner: jointly plan activities and potential real-world meetings.
9. Trust & Safety: verification, blocking, reporting, moderation and account safety.
10. VIBE Premium: subscription-based additional features.

Do not implement every feature immediately. Build the foundation first and follow the development phases.

## 3. Technology Stack

Use the following stack unless a technical incompatibility requires a documented alternative:

**Mobile:** React Native, Expo, TypeScript, Expo Router, TanStack Query (server state), Zustand (light client state), React Hook Form, Zod.

**Backend:** Node.js, NestJS, TypeScript, REST API, Socket.IO (real-time), Prisma ORM.

**Data and Infrastructure:** PostgreSQL; Redis (caching, rate limiting, temporary state); S3-compatible object storage for photos and audio; Firebase Cloud Messaging and APNs; Sentry; GitHub Actions for CI/CD.

Use a modular monolith architecture initially. Do not introduce microservices without a clear technical reason.

## 4. Architecture Requirements

Backend modules: Auth, Users, Profiles, Discovery, Matching, Chat, Voice, Games, Groups, Plans, AI, Safety, Notifications, Payments, Admin.

Each module should have clear responsibilities and well-defined interfaces. Use controllers for HTTP requests, services for business logic, DTOs for input validation and dedicated persistence abstractions where appropriate.

The mobile application must communicate with the backend through API endpoints. Never connect the mobile application directly to PostgreSQL. Never expose API secrets, private credentials or privileged tokens in the mobile application.

## 5. Database

Use PostgreSQL and Prisma.

Initial entities: User, Profile, ProfilePhoto, Interest, UserInterest, Preference, Like, Match, Conversation, Message, VoiceProfile, Block, Report, Verification, Group, GroupMember, Plan, PlanParticipant, GameSession, GameAnswer, Subscription, Payment, Notification, UserDevice, AuditLog.

- Define primary keys, foreign keys, unique constraints, indexes and deletion behavior explicitly.
- Use database migrations. Never modify the production database schema manually.
- Do not store passwords in plaintext. Use a secure password hashing algorithm.
- Store photos and audio in object storage, not directly in PostgreSQL.
- Avoid storing unnecessary personal information.

## 6. Matching Logic

The initial matching algorithm should be deterministic and explainable. Consider: explicit user preferences, age preferences, location preferences, shared interests, lifestyle compatibility, relationship expectations, communication preferences, activity preferences.

- Apply hard eligibility filters before compatibility scoring.
- Never recommend blocked users or profiles that should not be visible.
- Do not infer sensitive personal attributes. Use only information users explicitly provide and consent to use.
- Compatibility explanations must be transparent and must not claim scientific certainty.
- AI should assist with natural-language preference extraction and explanations. The initial recommendation engine should remain independently testable without an AI provider.

## 7. Security and Privacy

Security is a core product requirement, not a later enhancement. Implement:

- Authentication and authorization
- Secure access and refresh token handling
- Input validation
- Rate limiting
- Secure password hashing
- Role-based admin access
- Server-side access control
- Private media storage and controlled access
- Blocking and reporting
- Account deletion
- Data export and privacy controls
- Audit logging for important administrative actions
- Protection against unauthorized conversation access
- Protection against duplicate likes and matches

The application must be restricted to users aged 18 and above. Never expose exact user coordinates to other users. Design privacy and consent processes for KVKK and GDPR compliance. Do not log passwords, authentication tokens, private messages or sensitive personal information.

## 8. API Design

Use versioned endpoints under `/api/v1`, organized by module. Examples:

```
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /users/me
PATCH /users/me
GET  /discovery
POST /likes
POST /passes
GET  /matches
GET  /conversations
POST /conversations/:id/messages
POST /safety/block
POST /safety/report
POST /plans
```

Use consistent response structures, error codes, pagination and validation. Generate and maintain Swagger/OpenAPI documentation.

## 9. Mobile App Navigation

Primary navigation: Discover, Matches, Voice, Plans, Profile.

The visual direction should be premium, modern, minimal and distinctive; polished, intuitive and friendly. Use reusable components, a centralized design system, consistent spacing, typography, colors and responsive layouts. Do not create a generic template-looking dating application.

## 10. Development Principles

- Work in small, independently testable phases.
- Do not generate the entire application in one response.
- Do not skip architecture or database planning.
- Do not create placeholder implementations that appear functional but are not.
- Do not silently omit errors.
- Do not hardcode credentials or production URLs.
- Do not introduce unnecessary dependencies.
- Do not duplicate business logic.
- Keep TypeScript strict.
- Use environment variables for configuration.
- Write tests for important business rules.
- Use database migrations for schema changes.
- Document important technical decisions.
- Keep README and .env.example updated.
- Ensure the project can be started from a clean environment using documented commands.

Before changing existing code, inspect the relevant files and understand their dependencies. When something fails, identify the root cause, fix it and rerun the relevant tests. Do not rewrite working parts of the project unnecessarily.

## 11. Testing Requirements

At minimum, test: registration and login; token refresh and expiration; profile creation and editing; photo upload authorization; discovery filtering; like and mutual match creation; duplicate match prevention; conversation access permissions; message authorization; blocking behavior; reporting behavior; plan participation; subscription entitlement checks.

Include unit tests and integration tests. Add end-to-end tests for the most important user journeys.

## 12. First Development Task

Do not start implementing all product features. First, analyze this brief and produce:

1. A complete technical architecture document.
2. A proposed repository structure.
3. A database relationship diagram.
4. A first version of the Prisma schema.
5. An API module specification.
6. A development roadmap with dependencies.
7. A list of unresolved product and technical decisions.
8. A list of potential risks and how to prevent them.

Then wait for approval before implementing the first phase.

We want a maintainable, secure and production-oriented product, not just a visual prototype.

Every implementation phase must end with: files created or changed; commands to run; tests performed; test results; known limitations; next recommended task.

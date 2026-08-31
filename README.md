# EasyTrip 🌍

> Discover Your Next Adventure – A modern travel destination platform built with Next.js, Node.js, and PostgreSQL (A Full Stack Project)

[![Next.js](https://img.shields.io/badge/Next.js-13.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-lightgrey?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-336791?logo=postgresql)](https://postgresql.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-yellow?logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue?logo=tailwindcss)](https://tailwindcss.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Images-lightblue?logo=cloudinary)](https://cloudinary.com/)

---

## 📸 Project Previews

> Sneak peek into the EasyTrip experience

### 🏠 Landing Page (Home Section)

![Landing Page (Home section)](./preview1.png)

---

### 🌍 Discover Amazing Places (Browse Section)

![Discover Amazing places (Browse section)](./preview2.png)

---

### ✨ Why Choose EasyTrip

![Why Choose EasyTrip](./preview3.png)

---

### 🔎 Search in Browse Section

![Search in Browse section](./preview4.png)

---

### 🗺️ Checking Out a Tourism Spot (Hero Section)

![Tourism Spot](./preview5.png)

---

### 📖 Explore About the Place

![About Place](./preview6.png)

---

### ☀️ Weather Widget & Map Location

![Weather & Map](./preview7.png)

> ⚠️ **This screenshot predates two changes, and the caveat that replaced it also went stale.**
> The map is a Google Maps embed driven by the place's stored coordinates and works as shown.
>
> The weather panel in this shot was **fabricated** — a hardcoded forecast presented as real — and
> was deleted rather than left looking functional. It has since been **rebuilt for real** against
> Open-Meteo, keyed on the place's own coordinates, and it now states an absence instead of showing
> a number when there is no reading. So the panel is genuine again, but it does not look like this.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Not Yet Implemented](#-not-yet-implemented)
- [Technology Stack](#️-technology-stack)
- [Project Architecture](#-project-architecture)
- [Architecture Patterns](#️-architecture-patterns)
- [Installation & Setup](#-installation--setup)
- [API Documentation](#-api-documentation)
- [Data Sources & Attribution](#️-data-sources--attribution)
- [Known Issues & Lessons Learned](#-known-issues--lessons-learned)
- [Commit & Branch Hygiene](#-commit--branch-hygiene)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)
- [Roadmap](#-roadmap)

---

## 🌟 Overview

**EasyTrip** is a travel destination discovery platform designed to help users explore destinations, read and write reviews, and browse places on an interactive map. Curated destination content is managed through an admin panel with full create/edit/delete and image upload.

> **Honest status:** the feature lists below describe what is actually implemented in this repository today. Anything advertised but not yet built lives in [Not Yet Implemented](#-not-yet-implemented) rather than being listed as a feature.

---

## 🚀 Features

### ✨ User Features

- 🏞️ **Destination Discovery** – Browse curated destinations with image-rich cards
- 🔍 **Ranked search with typeahead** – Postgres `tsvector` search weighted by field (name > place > tags > description), so `temples` finds `temple` and a place _named_ for your query outranks one that merely mentions it. Suggestions appear as you type, and filters for location, district, state and tags all run server-side
- ⭐ **Ratings & Reviews** – Read reviews and post a 1–5 star rating with a comment; one review per user per place (enforced by a `UNIQUE` constraint + upsert), with place averages maintained by a PostgreSQL trigger
- 📱 **Responsive Design** – Optimized for all devices
- 🖼️ **Magazine-Style Detail Pages** – Full-bleed hero, carousels, related places, and a Google Maps embed for the location
- 🗺️ **Explore Map** – Leaflet map with marker clustering, multiple tile layers, a geolocation radius filter, and in-map search
- ❤️ **Saved Places** – Heart any destination and find it again on `/saved`; persisted per user, server-side, and it follows you to another device
- 🚩 **Report a Review** – Reports are persisted and feed a real admin moderation queue
- 🗺️ **Trip Workspace** – Build an itinerary day by day: ordered items, times, notes, and transport legs between stops
- ✅ **Feasibility check** – A deterministic answer to "can this plan actually be done?": days outside the trip's dates, overlapping times, not enough time to travel between two stops, a day that doubles back on itself. It separates _cannot be done_ from _worth a look_, and every travel figure says it is an estimate — there is no routing service behind it, and the assumptions are printed rather than hidden
- 🧭 **Route ordering** – For a day of stops, it looks for a shorter way round the same places, shows which ones would move and how much driving that saves, and then waits: it suggests, and never rearranges anything on its own. Days that already have times on them are left alone, because the clock decides that order
- 🗺️ **The day on a map** – Draws a day's stops in the order you arranged them, so a day that doubles back looks like one. The line is dashed on purpose: it shows the order, not the road. Every leg says whether it was measured or estimated, and a stop with no coordinates is named rather than quietly left off. The map is decorative — the same order, distances and omissions are a list beside it, for readers who cannot see a shape
- ♿ **Step-free access, with its receipts** – Filter the catalogue to places somebody has actually checked for step-free access, and see the answer on the card **with the date it was checked** — never a bare tick. The place page says who checked and what they found. A place nobody has surveyed shows nothing at all rather than a greyed-out badge, because "not checked" and "not accessible" are different answers and only one of them is safe to guess
- ☀️ **Real Weather** – A live Open-Meteo forecast on each place page, keyed on that place's own coordinates. When there is no reading it says so rather than showing a number
- 📴 **Installable & Offline** – A PWA: install it, and pages you have already visited still open with no connection
- 🔐 **Accounts** – Firebase email/password + Google sign-in, with an editable display name

### 🛡️ Admin Features

- 🖊️ **Content Management** – Create, edit, and delete destinations
- 📦 **Image Management** – Cloudinary-backed upload with a drag-and-drop admin UI, multi-image galleries, and an SVG placeholder fallback
- 👥 **User Management** – List users and grant or revoke admin rights, from the dashboard and over the API (`/api/admin/admins`)
- 🚩 **Moderation Queue** – Reported reviews, grouped one row per review however many people reported it. Reporter identity is never exposed, to the admin or anyone else
- 📊 **Analytics** – Real catalogue figures, plus a _needs attention_ panel that links to the work: places with no coordinates, places with no image, reports awaiting a decision
- 📍 **Address Lookup** – Fill a place's coordinates from its address via OpenStreetMap. One match fills the form; several are offered for a choice rather than guessed at

### 🧪 Engineering

- ✅ **1,329 assertions across three layers** – 703 API tests against a real PostgreSQL, 497 component tests, and 129 browser journeys including ones that really sign in through the Firebase Auth Emulator and drive client-rendered pages as that user. Measured at Sprint 8.37, by running all three suites; reproduce with `cd backend && npm test`, `cd frontend && npm test`, `npm run test:e2e`
- 🧬 **Mutation-tested invariants** – load-bearing behaviour is verified by deliberately breaking it and checking a test fails. Schema mutations run against a database dropped and recreated each time, because `CREATE TABLE IF NOT EXISTS` makes them invisible otherwise
- 🔎 **SEO** – server-rendered pages, `sitemap.xml` generated from the live catalogue, `robots.txt`, and schema.org `TouristAttraction` structured data
- ⚙️ **CI on every push** – six jobs: lint and build, frontend tests, migrations, API tests, end-to-end, and a job that checks the assertion counts above against what the suites actually ran
- 🗄️ **Real migrations** – versioned, checksummed, and applied by a runner rather than at boot

---

## 🧭 Not Yet Implemented

Built-but-incomplete or not started. Listed here so the feature list above stays honest.

| Feature                       | Status today                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🌐 Multi-language (i18n)      | English only. The mechanism is not built, and the blocker is content rather than code — a locale switcher with nothing translated behind it is not a feature                                                                      |
| 🖼️ Link-preview card art      | `og:image` points at the place's own photo, which is real and correct, but not a generated card with the name composited onto it                                                                                                  |
| ✉️ Email verification         | Password reset works, but a new account's address is never confirmed                                                                                                                                                              |
| ⚡ Google One Tap             | Deliberately removed — it was configured with a Firebase API key where a Google OAuth Client ID belongs, so it could never work. Google **popup** sign-in is supported                                                            |
| 📴 Offline for signed-in data | Cached pages work offline; saved places, trips and profile do not. A service worker cache is per browser, not per person, so caching them would hand one user's data to the next person on a shared device — a deliberate refusal |

> **Why this table keeps changing.** Four rows were removed on 2026-08-15 because the features
> arrived: weather, trips, the moderation queue and the analytics dashboard. This is the second time
> the section has gone stale — an earlier commit is literally titled _"the honesty table had stopped
> being honest"_. The failure mode is structural rather than careless: a list of what is missing
> decays every time something ships, and nothing fails when it does. **Treat it as a release-checklist
> item, not a document that maintains itself** — `RELEASE_CHECKLIST.md` now says so.

---

## 🛠️ Technology Stack

### 🎨 Frontend

- **Next.js 13.5** - React framework, **Pages Router** (`frontend/src/pages`). Rendering is chosen per route rather than globally: the home page and `/places/[id]` are `getStaticProps` + ISR (`revalidate: 300`), `/browse` is `getServerSideProps` because its content is a function of eight filter dimensions crossed with free text and has no bounded set of paths to pre-render, and the four `/admin/*` pages are `getServerSideProps` for the auth gate
- **React 18.2** - Modern React with hooks and context
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library for smooth interactions
- **Leaflet + markercluster** - Explore map on the browse page
- **React Icons** - Comprehensive icon library
- **Axios** - HTTP client for the API service layer

### ⚙️ Backend

- **Node.js** - JavaScript runtime (CommonJS)
- **Express.js 4** - Web application framework
- **PostgreSQL** - Relational database, accessed with `pg` (`SERIAL`, `TEXT[]`, `JSONB`, `plpgsql` triggers)
- **Multer** - File upload middleware
- **Helmet** - Security response headers
- **express-rate-limit** - Global ceiling plus tighter buckets on reviews, uploads, and admin writes
- **express-validator** - Request validation on review, place, profile, and admin writes
- **CORS** - Explicit origin allowlist from `CORS_ALLOWED_ORIGINS` (no wildcard)

### 🔐 Auth & Storage

- **Firebase Auth** - Email/password + Google sign-in on the client
- **Firebase Admin SDK** - Server-side verification of Firebase ID tokens (`Authorization: Bearer <idToken>`)
- **Cloudinary** - Image storage and optimization

### 🛠️ Dev Tools

- **PostCSS + Autoprefixer** - CSS processing
- **Nodemon** - Backend dev server reload
- **Git** - Version control

---

## 🏗️ Project Architecture

```bash
EasyTrip/
├── backend/                    # Node.js + Express API
│   ├── app.js                  # Entry point: CORS, routes, health check, pg pool
│   ├── script/                 # make-admin.js (grant admin), migrate.js (the migration runner)
│   ├── tests/                  # Jest + supertest, against a real PostgreSQL
│   └── src/
│       ├── config/
│       │   ├── migrations/     # Numbered, checksummed .sql — the upgrade path
│       │   ├── schema.sql      # The fresh-database path
│       │   └── seed.js         # Deterministic fixtures, shared by tests and `npm run seed`
│       ├── controllers/        # Request handling / business logic
│       ├── models/             # SQL data access (parameterized queries)
│       ├── routes/             # Express routers
│       ├── services/           # Outbound integrations (weather, geocoding)
│       └── utils/              # Auth middleware & helpers
│
├── frontend/                   # Next.js app (Pages Router)
│   ├── public/                 # Static assets, manifest, service worker
│   ├── tests/                  # Jest + React Testing Library
│   └── src/
│       ├── components/         # UI components
│       ├── config/             # Firebase client config
│       ├── context/            # Auth / user context
│       ├── hooks/              # Custom hooks
│       ├── pages/              # Routes (incl. pages/api image helpers)
│       ├── services/           # API clients (axios)
│       ├── styles/             # Global styles
│       └── utils/              # Utilities
│
├── e2e/                        # Playwright journeys + the Firebase Auth Emulator harness
└── scripts/                    # Repository guards run in CI (see below)
```

`scripts/` holds the checks that keep this file and the codebase honest — module size,
credential-shaped strings, environment documentation, the theme and translation vocabularies, the
test counts quoted above, and the API route table below, which is compared against the real routers
in both directions. They are guards rather than tests: each one fails on a fact about the repository,
not on behaviour.

---

## 🏛️ Architecture Patterns

> Patterns the codebase actually uses:

- 🗂️ **Routes → Controllers → Models** – Separation of concerns in the backend; all SQL is parameterized (`$1`, `$2`, …)
- ⚛️ **Component-Based UI** – Reusable and modular React/Next.js components
- 🌐 **Context API** – Centralized global state for authentication & user data, consumed via a `useAuth()` hook
- 🧮 **Denormalized rating aggregates** – `rating_sum` / `rating_count` on `places` are kept in sync by a `plpgsql` trigger on every review write, so list pages never aggregate at read time
- 🔗 **API-First Design** – RESTful endpoints consumed by an axios service layer

---

## 🔧 Installation & Setup

<details>
<summary>▶️ Expand Installation Guide</summary>

---

### Prerequisites

- Node.js (v18.0 or higher)
- PostgreSQL (v13 or higher) — local, or a managed instance such as Supabase / Neon / RDS
- npm or yarn
- Firebase project (Authentication + a service account for the Admin SDK)
- Cloudinary account

---

### Environment Variables

Copy the environment template for each tier and fill in real values. `backend/.env` and
`frontend/.env.local` are gitignored, and **neither should ever be committed**.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Each template documents every variable and where to obtain it. Summary:

#### Backend (`backend/.env`)

```bash
# Database — connection string used by app.js, the models, and script/make-admin.js
DATABASE_URL=postgresql://user:password@host:5432/easytrip

# DATABASE_URL is the only database variable the server reads. The discrete
# POSTGRES_HOST/PORT/USER/PASSWORD/DB set that this file used to list belonged
# to a second connection pool, and that pool was deleted when IMP-044 collapsed
# nine of them into one. They are documented in docker-compose.yml because the
# Postgres *container* takes them; nothing in backend/ does.

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_STORAGE_BUCKET=your_project.appspot.com

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Server Configuration
PORT=5000
NODE_ENV=development

# Comma-separated list of browser origins allowed by CORS.
# Falls back to http://localhost:3000 outside production.
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Number of reverse proxies in front of the API. Leave UNSET for local development.
# Rate limiting buckets by client IP, which behind a proxy arrives in X-Forwarded-For.
# Set this to the hop count (1 on Render/Railway/Fly/Heroku) or every request is
# attributed to the proxy's IP and one busy visitor rate-limits everyone.
# Do not guess high: trusting more hops than actually exist lets a caller spoof its
# own IP via X-Forwarded-For and defeat the limiter entirely.
# TRUST_PROXY_HOPS=1
```

> **`DATABASE_URL` is the whole database configuration.** There is exactly one `new Pool()` in the
> server, in `src/config/db.js`, and it carries the TLS settings with it — which is what made
> verifying the certificate a one-line change instead of a nine-file one.
>
> _(This paragraph used to say both `DATABASE_URL` and a `POSTGRES_*` set were required, describing
> a second pool that `IMP-044` deleted when it collapsed nine pools into one. `db.js` and
> `backend/.env.example` had both said so for weeks. Since 2026-08-16 `npm run check:env-docs`
> fails on a documented variable that nothing reads, so this particular fiction cannot come back.)_

---

#### Frontend (`frontend/.env.local`)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
```

---

### Database Setup

**Option A — Docker (recommended).** Starts Postgres and creates the schema on first run:

```bash
docker compose up -d
```

The matching `DATABASE_URL` for `backend/.env` is
`postgresql://easytrip:easytrip@localhost:5432/easytrip`. To start completely over:
`docker compose down -v && docker compose up -d`.

**Option B — an existing PostgreSQL install.** Create the database and apply the schema:

```bash
createdb easytrip
psql "$DATABASE_URL" -f backend/src/config/schema.sql
```

**Then, either way, bring the schema up to date:**

```bash
npm run migrate
```

This applies every unapplied file in `backend/src/config/migrations/` and records it in a
`schema_migrations` table. It is safe to re-run — every migration is idempotent — and safe on a
database whose migrations were previously applied by hand, which it will simply record.

```bash
npm run migrate:status
```

shows what is applied and what is pending without changing anything. The server also reports
unapplied migrations at boot, read-only. See
[`backend/src/config/migrations/README.md`](backend/src/config/migrations/README.md) for the
conventions, and `ADR-025` for why there is a hand-written runner rather than node-pg-migrate.

---

### Backend Setup

1. **Install Dependencies:**

```bash
cd backend
npm install
```

2. **Start Development Server:**

```bash
npm run dev
```

The backend will run on `http://localhost:5000`

---

### Frontend Setup

1. **Install Dependencies:**

```bash
cd frontend
npm install
```

2. **Start Development Server:**

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

---

### Creating Admin User

The user must already have signed up through Firebase Authentication. The script then flips
`users.is_admin` and sets the matching Firebase custom claim:

```bash
cd backend/script
node make-admin.js user@example.com
```

> Run it from `backend/script/`: the script loads `../.env` relative to the current working
> directory, and it requires `DATABASE_URL` plus the `FIREBASE_*` service-account variables.

---

### Production Environment Variables

Update your environment variables for production:

```bash
# Backend
NODE_ENV=production
DATABASE_URL=postgresql://user:password@your-production-host:5432/easytrip
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
TRUST_PROXY_HOPS=1

# Frontend
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

> `CORS_ALLOWED_ORIGINS` has **no fallback in production** — if you leave it unset the server
> **refuses to boot**, rather than starting up and rejecting every browser origin. Set it to your
> deployed frontend origin.

> `TRUST_PROXY_HOPS` must be set on any platform that terminates TLS in front of the app
> (Render, Railway, Fly, Heroku — almost always `1`). Without it every request is rate-limited
> under the proxy's IP, so a single busy visitor can 429 the whole site. Setting it higher than
> the real hop count is worse than leaving it unset: a caller can then forge `X-Forwarded-For`
> and bypass rate limiting entirely.

---

### Database Backup & Schema

1. **Backup existing data:**

```bash
pg_dump "$DATABASE_URL" > backup.sql
```

2. **Apply the schema — only for a database that does not exist yet:**

```bash
psql "$PRODUCTION_DATABASE_URL" -f backend/src/config/schema.sql
```

3. **Migrate — for every deploy, including the first:**

```bash
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run migrate
```

> Run this **before** starting the new build. The server no longer patches the schema at boot; it
> reports unapplied migrations and keeps running, so a deploy that skips this step looks healthy
> until the first request touches a column that is not there.
>
> Safe to run against a database whose migrations were previously applied by hand: every migration
> is idempotent, so the first run re-applies them as no-ops and records them. `npm run migrate:status`
> shows the state without changing anything. `schema.sql` is now fully re-runnable too — its
> `CREATE TRIGGER` statements are preceded by `DROP TRIGGER IF EXISTS`, which they were not before
> Sprint 5.2.

---

### Deployment Steps

1. **Build the application:**

```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm install --production
```

2. **Deploy to your hosting platform:**
   - **Frontend**: Deploy to Vercel, Netlify, or similar
   - **Backend**: Deploy to Render, Railway, or a VPS
   - **Database**: Use a managed PostgreSQL service (Supabase, Neon, AWS RDS, etc.)

3. **Configure environment variables** in your hosting platform

4. **Set up domain and SSL certificates**

---

## 📚 API Documentation

### Base URL

```
http://localhost:5000/api
```

**Authentication:** there are no login/register endpoints — sign-in happens client-side through
Firebase. Protected routes expect the resulting Firebase ID token as
`Authorization: Bearer <idToken>`, which the API verifies with the Firebase Admin SDK.
Admin routes additionally require the account to be an admin (`users.is_admin`).

The table below is the complete set of Express routes the backend actually registers.

### Health

| Method | Endpoint  | Auth | Description               |
| ------ | --------- | ---- | ------------------------- |
| GET    | `/health` | -    | Service + database status |

### Places - public reads

| Method | Endpoint                      | Auth | Description                                                                                                                                                |
| ------ | ----------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/places`                     | -    | List places. Filters: `searchTerm`, `location`, `district`, `state`, `tags`, `themes`, `minRating`, `date`. Paged with `limit`/`offset`, ordered by `sort` |
| GET    | `/places/search`              | -    | The same handler under a second name                                                                                                                       |
| GET    | `/places/suggest`             | -    | Typeahead suggestions (`q`, `limit` up to 10)                                                                                                              |
| GET    | `/places/locations`           | -    | Distinct locations                                                                                                                                         |
| GET    | `/places/districts`           | -    | Distinct districts                                                                                                                                         |
| GET    | `/places/states`              | -    | Distinct states                                                                                                                                            |
| GET    | `/places/tags`                | -    | Distinct tags                                                                                                                                              |
| GET    | `/places/:id`                 | -    | One place                                                                                                                                                  |
| GET    | `/places/:id/image`           | -    | Primary image (redirect, with an SVG placeholder fallback)                                                                                                 |
| GET    | `/places/:id/images`          | -    | Gallery images                                                                                                                                             |
| GET    | `/places/:id/images/:imageId` | -    | Same handler as `/places/:id/image`                                                                                                                        |
| GET    | `/places/:id/weather`         | -    | Live forecast for that place's own coordinates. Deliberately **not** `?lat=&lon=`, which would be an open proxy to a third party at our IP                 |
| GET    | `/places/:id/reviews`         | -    | Reviews. Soft-authenticated: your own review is flagged for the edit UI, but no author id is ever returned                                                 |

### Reviews - writes

| Method | Endpoint                               | Auth   | Description                                                                                                                |
| ------ | -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/places/:id/reviews`                  | Bearer | Create or update your review - `{ rating: 1-5, comment }`. A second review edits the first                                 |
| DELETE | `/places/:id/reviews/:reviewId`        | Bearer | Delete a review. Authors may delete their own; **admins may delete any**, through this same route rather than a second one |
| POST   | `/places/:id/reviews/:reviewId/report` | Bearer | Report a review for moderation. Idempotent per person                                                                      |

### Profile and personal data

| Method | Endpoint                   | Auth   | Description              |
| ------ | -------------------------- | ------ | ------------------------ |
| GET    | `/auth/profile`            | Bearer | Your profile row         |
| PUT    | `/auth/profile`            | Bearer | Update your profile      |
| GET    | `/auth/check-admin`        | Bearer | Whether you are an admin |
| GET    | `/auth/reviews`            | Bearer | Your review history      |
| GET    | `/auth/favorites`          | Bearer | Your saved places        |
| POST   | `/auth/favorites`          | Bearer | Save a place             |
| DELETE | `/auth/favorites/:placeId` | Bearer | Unsave a place           |

### Trips

Days and items carry no owner of their own - every query joins up to `trips.user_id`. A second
account cannot reach them even by addressing a victim's item through its own trip id.

| Method | Endpoint                                           | Auth   | Description                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/auth/trips`                                      | Bearer | Your trips                                                                                                                                                                                                                                                               |
| POST   | `/auth/trips`                                      | Bearer | Create a trip                                                                                                                                                                                                                                                            |
| GET    | `/auth/trips/:tripId`                              | Bearer | One trip, with its days and items                                                                                                                                                                                                                                        |
| GET    | `/auth/trips/:tripId/feasibility`                  | Bearer | Deterministic check that the plan can be executed — day bounds, overlaps, ordering, travel time (real road distance when a routing key is configured, otherwise a labelled estimate), daylight, wet outdoor days, backtracking, duplicates. Reports; never blocks a save |
| PUT    | `/auth/trips/:tripId`                              | Bearer | Update a trip                                                                                                                                                                                                                                                            |
| DELETE | `/auth/trips/:tripId`                              | Bearer | Delete a trip                                                                                                                                                                                                                                                            |
| GET    | `/auth/trips/:tripId/replan-suggestion`            | Bearer | What to change when the forecast disagrees with the plan — which outdoor stops to move off a wet day, to which drier day, and why. Every proposal is validated against the whole trip first. Proposes only; applying goes through the item endpoint                      |
| GET    | `/auth/trips/:tripId/days/:dayId/route-suggestion` | Bearer | A shorter order for one day, with the distance saved. Proposes only — applying it goes through the reorder route                                                                                                                                                         |
| GET    | `/auth/trips/:tripId/days/:dayId/route`            | Bearer | One day as it would be drawn: its stops in list order, the leg between each pair, and what the map is leaving out. Road distance when a routing key is configured, a labelled estimate otherwise                                                                         |
| POST   | `/auth/trips/:tripId/days`                         | Bearer | Add a day                                                                                                                                                                                                                                                                |
| DELETE | `/auth/trips/:tripId/days/:dayId`                  | Bearer | Remove a day                                                                                                                                                                                                                                                             |
| POST   | `/auth/trips/:tripId/days/:dayId/items`            | Bearer | Add an item to a day                                                                                                                                                                                                                                                     |
| PUT    | `/auth/trips/:tripId/days/:dayId/items/order`      | Bearer | Reorder a day. Takes the **full** order; a partial list is rejected rather than partly applied                                                                                                                                                                           |
| PUT    | `/auth/trips/:tripId/items/:itemId`                | Bearer | Update an item                                                                                                                                                                                                                                                           |
| DELETE | `/auth/trips/:tripId/items/:itemId`                | Bearer | Remove an item                                                                                                                                                                                                                                                           |

### Admin

| Method | Endpoint                            | Auth  | Description                                                                                             |
| ------ | ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| POST   | `/admin/places`                     | Admin | Create a place (`multipart/form-data`, field `image`)                                                   |
| PUT    | `/admin/places/:id`                 | Admin | Update a place (`multipart/form-data`, field `image`)                                                   |
| DELETE | `/admin/places/:id`                 | Admin | Delete a place                                                                                          |
| POST   | `/admin/places/:id/images`          | Admin | Add a gallery image                                                                                     |
| DELETE | `/admin/places/:id/images/:imageId` | Admin | Remove a gallery image                                                                                  |
| GET    | `/admin/admins`                     | Admin | List admin accounts                                                                                     |
| POST   | `/admin/admins`                     | Admin | Grant admin rights                                                                                      |
| DELETE | `/admin/admins/:email`              | Admin | Revoke admin rights                                                                                     |
| GET    | `/admin/reports`                    | Admin | Moderation queue, one row per reported review. Filter by `status`. No reporter or author id is returned |
| PATCH  | `/admin/reports/reviews/:reviewId`  | Admin | Resolve every open report on a review - `{ resolution }`. `409` when another moderator already did      |
| GET    | `/admin/analytics`                  | Admin | Catalogue figures, rating distribution, review activity, and places needing attention                   |
| GET    | `/admin/geocode`                    | Admin | Forward geocoding (`q`), paced to 1 req/s as the OpenStreetMap usage policy requires                    |

### Newsletter

| Method | Endpoint      | Auth | Description                                    |
| ------ | ------------- | ---- | ---------------------------------------------- |
| POST   | `/newsletter` | -    | Subscribe. Rate-limited to 5 attempts per hour |

### Example API Usage

```javascript
// Fetch all places (public)
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/places`);
const places = await res.json();

// Post a review (requires a Firebase ID token)
const idToken = await auth.currentUser.getIdToken();

await fetch(`${process.env.NEXT_PUBLIC_API_URL}/places/${placeId}/reviews`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`
  },
  body: JSON.stringify({ rating: 5, comment: 'Stunning at sunrise.' })
});
```

> The reviewer's identity is taken from the verified token on the server — it is never read from
> the request body.

---

</details>

---

## 🗺️ Data Sources & Attribution

Two third-party datasets are rendered in this product, and both carry obligations that are part of
the software rather than a footnote.

| Source                                                                 | Used for                                                                         | Licence                  | What that requires of us                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via Nominatim | Map tiles on the explore map, and coordinates filled by the admin address lookup | **ODbL**                 | Attribution — **for the tiles and, separately, for the geocoding output.** Max 1 request/second, an identifying `User-Agent`, results cached, and **no auto-complete**, which the usage policy forbids by name |
| [Open-Meteo](https://open-meteo.com/)                                  | The forecast panel on each place page                                            | **CC-BY 4.0**, free tier | Attribution, and the free tier is **non-commercial only**                                                                                                                                                      |

Three consequences that are easy to miss:

- **Geocoding attribution is a separate obligation from tile attribution** (ODbL §4.3). It is
  satisfied per place, not site-wide: `places.coordinates_source` records which pins a geocoder
  produced, so the notice appears on those and not on the ones an admin typed. A blanket notice
  would have been one line and would have credited OpenStreetMap for coordinates it never supplied.
- **Share-alike is not triggered.** Individual geocoding results are insubstantial extracts and may
  be stored beside proprietary data; aggregating them into a database that reproduces a substantial
  part of OpenStreetMap would be a different question.
- **Open-Meteo's free tier ends at monetisation, not at a request count.** Putting an advertisement
  or a subscription on this site would breach it without a line of code changing. That is a product
  decision with an API consequence, and it is on the release checklist rather than in someone's head.

The typeahead is **not** a geocoder call — it runs against this project's own PostgreSQL, which is
why an as-you-type suggestion list is compatible with a policy that forbids auto-complete.

---

## 🔬 Known Issues & Lessons Learned

This project began as a university team project and has been rebuilt in the open. The list below is
deliberate: **the defects are more interesting than the features**, and every one of them is a thing
this codebase now has a guard against.

### The one worth leading with: authentication was broken by construction

The original build never initialised the Firebase Admin SDK on the server. It compensated with a
development bypass — a request carrying the header `x-user: AdminX` was treated as an authenticated
administrator.

That is not a bug that slipped through review. It is a **dev/prod parity failure**: the local
experience was designed around not having working authentication, so nothing in day-to-day
development ever exercised the real path, and the bypass became load-bearing. Removing it in
isolation would have turned every request into a 401; initialising the SDK in isolation would have
left the bypass live. The three fixes had to land together.

**What replaced it:** the SDK initialises at boot and the process **exits** if its service-account
variables are missing — a server that cannot verify a token refuses to start rather than 401-ing
every request in production. `users.is_admin` in PostgreSQL is the authority for admin status; a
Firebase custom claim is treated as a cache of it, and a disagreement between the two is detected
rather than trusted.

**The lesson that generalises:** a convenience that only exists in development will be relied upon,
and the more useful it is the more load it silently takes. The verification for this one is 11
forged-token attacks rejected against a booted server, plus authenticated browser journeys driving
real tokens through the Firebase Auth Emulator.

### Six defects that shipped, and how each was found

None of these were found by reading the code. Each has a guard now.

| Defect                                                                                                                        | How it was found                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `og:url` was computed from `window.location`, so it shipped as `content=""` to every crawler — the one consumer that reads it | Writing an E2E assertion against the **raw response body** rather than the hydrated DOM. A browser-based check would have passed |
| A React state handler used the spread form, so two fields set in one batch lost the first                                     | A test that filled three form fields at once. No user had hit it, because typing is one event per tick                           |
| One of five admin pages had no server-side gate                                                                               | Adding a sixth page and looking for the pattern to copy — the page I might have copied was the broken one                        |
| A test suite was quietly calling a **live** third-party service on every run                                                  | A surviving mutation that pointed at a missing assertion, which turned out to be sitting on top of the real problem              |
| A database index test passed or failed depending on which pooled connection answered                                          | A mutation run, where it failed for changes that had nothing to do with indexing                                                 |
| Two backlog items were being implemented for reasons that had stopped being true                                              | Verifying the premise before the fix, rather than only afterwards                                                                |

### The habit behind most of those: mutation testing

Load-bearing behaviour is verified by **deliberately breaking it and checking that a test fails.**
Schema changes run against a database dropped and recreated each time — `CREATE TABLE IF NOT EXISTS`
makes a migration mutation invisible against a re-used one, which cost two survived mutations before
it was understood.

The genuinely useful output is not the score. It is the **attribution**: when an assertion fails for
a mutation it has no business detecting, that assertion is passing for the wrong reason. Two of the
defects above were found exactly that way.

### Documentation decays, so some of it is enforced

Three claims in this README were false at some point _because the code improved_: an endpoint table
that fell 23 routes behind, a "not yet implemented" list that kept describing shipped features, and
a test count that only ever went up.

A document nobody can fail is a document that drifts. So the falsifiable parts are now checked in
CI — `npm run check:api-docs` compares this file's route table against the routers in both
directions, and fails on an undocumented route _or_ a documented one that does not exist.

The test count is checked the same way, and it took a second attempt to do honestly. Counting
`test(`/`it(` in the source is the obvious approach and it is wrong — it reports 455/316/78 against
the runners' actual 509/330/81, because `test.each` and generated cases produce more tests than
there are call sites, and a guard that is reliably off by fifty teaches people to edit the README
until it matches the wrong number. So `npm run check:test-counts` reads `numTotalTests` from the
runners themselves: the three suites publish what they ran, and a sixth CI job compares all three
against the sentence above. The headline total is also checked against its own three parts, which
needs no test run and catches the likelier edit — updating one layer and forgetting the sum.

---

## 🧾 Commit & Branch Hygiene

The early history contains bulk `Add files via upload` commits — the repository was originally
managed through the GitHub web UI. That history is **kept rather than rewritten**: it is honest
about how the project started, and rewriting shared history to look tidier is a worse habit than
having an untidy beginning.

Everything since adopts:

- **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `security:`, with a scope.
- **One cohesive change per commit**, with the reasoning in the body. The body explains _why_, and
  names the alternative that was rejected — that is the part which is expensive to reconstruct later.
- **A green tree at every commit.** Each lands with its tests, and the suites are run before it.

---

## 🚀 Deployment

**Deployment** is manual. CI is not: every push runs six jobs (see [Engineering](#-engineering)), but nothing deploys automatically on green.

- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Managed PostgreSQL

No public demo URL is published here yet; the screenshots above are from a local run.

---

## 🤝 Contributing

**[`CONTRIBUTING.md`](CONTRIBUTING.md) is the working manual** — setup in the order that works,
which test layer to reach for, the repository guards, and the house rules that are not obvious from
the code. Its goal is that you never have to ask a question to get from clone to pull request; a step
that needed one is a bug in that file.

The short version:

1. Fork the repo
2. Create a branch: `git checkout -b feat/amazing-feature`
3. Make the change **with its tests**, and run the suites for the tiers you touched
4. Commit in the conventional style described in
   [Commit & Branch Hygiene](#-commit--branch-hygiene) — `feat(scope): what changed`, with the
   _why_ and the rejected alternative in the body
5. Push the branch and open a Pull Request

Before pushing:

```bash
npm run lint          # all three tiers
npm run check:size    # no module over 500 lines outside the recorded waivers
npm run check:api-docs # this README's route table still matches the routers
npm run check:env-docs # the .env.example files still match what the code reads
```

_(Step 3 previously read `git commit -m "Add amazing feature"` — boilerplate that contradicted the
commit-hygiene section two headings below it. Corrected 2026-08-16.)_

---

## 📄 License

**MIT** — see [`LICENSE`](LICENSE).

All three `package.json` manifests declare `MIT` and the `LICENSE` file is present, so the
declaration and the file finally agree. They did not until now: the manifests said `ISC`, there was
no licence file at all, and an earlier version of this README claimed MIT — three different answers
to one question, which in practice meant nobody could reuse the code with confidence.

---

## 📞 Contact

EasyTrip is a **two-person team project**, not the work of a single author.

**Project Maintainers**  
👤 Dharmendra — [@dharmendra23101](https://github.com/dharmendra23101)  
👤 Mukund Thakur — [@Mukund934](https://github.com/Mukund934)

---

## 🧭 Roadmap

Near-term work is listed in [Not Yet Implemented](#-not-yet-implemented). The items below are
longer-term and **not started**.

### Next

- [x] **Itinerary feasibility** — shipped. It checks a planned day and says what does not fit,
      before any AI is allowed to generate one: the validator comes first precisely so a generated
      itinerary can be _checked_ rather than trusted. Travel times are estimates until a routing
      provider lands, and they say so
- [x] **Daylight-aware scheduling** — shipped. An outdoor stop scheduled before sunrise or after
      sunset is flagged, from the day's own coordinates and date. It stays quiet about a place
      nobody has classified and about any date past the forecast's seven-day horizon — an absent
      reading produces an absent finding, never an assumed one
- [x] **Weather-aware planning, the deterministic half** — shipped. A day the forecast says will be
      wet, carrying stops that are outdoors, is flagged with the stops named. That is the evidence a
      replanning proposal has to cite; proposing the move itself is the next stage, and it needs no
      model either
- [x] **Real road distances** — shipped, and optional. With an OpenRouteService key the travel-time
      check reports a measured road distance instead of a straight line inflated by a guess, and
      stops calling itself an estimate. Without one, nothing changes and nothing is requested
- [x] **Weather replanning** — shipped, as a proposal. When the forecast says a day will be wet and
      stops on it are outdoors, the app says which to move and to when, with the forecast either
      side. It proposes and never applies, and it says why it left things alone
- [ ] **Route optimisation** — reorder a day's stops to cut the backtracking, and show what changed
- [ ] **Collaborative trips** — invites, roles, and proposals rather than a shared password
- [ ] **Budget and expense splitting** — minimal-transaction settlement
- [ ] **Multi-language** — blocked on translation content, not on the mechanism
- [ ] **A live demo** — with working auth and seeded data

### Later, and deliberately vaguer

- [ ] Retrieval-grounded trip planning, with an evaluation harness built **before** the feature it
      measures
- [ ] Semantic search over the catalogue (`pgvector` on the database that already exists)
- [ ] Mobile app

### Ruled out

- **Autonomous booking or purchasing agents.** Spending someone's money without a human in the loop
  is not a feature this project wants, at any level of model quality.

> **This list used to advertise four things that had already shipped** — trip planning, offline
> support, weather, and a travel-content surface — because a roadmap decays every time an item lands
> and nothing fails when it does. Same failure as the
> [Not Yet Implemented](#-not-yet-implemented) table, same fix: it is a release-checklist item.

---

✨ _Happy Traveling with EasyTrip!_ 🌍✈️

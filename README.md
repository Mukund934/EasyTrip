# EasyTrip 🌍

> Discover Your Next Adventure – A modern travel destination platform built with Next.js, Node.js, and PostgreSQL (A Full Stack Project)

[![Next.js](https://img.shields.io/badge/Next.js-13.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0+-green?logo=node.js)](https://nodejs.org/)
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

> ⚠️ The map is a Google Maps embed driven by the place's stored coordinates and works as shown.
> The weather panel is a **UI placeholder** — no weather API is connected yet.
> See [Not Yet Implemented](#-not-yet-implemented).

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Not Yet Implemented](#-not-yet-implemented)
- [Technology Stack](#️-technology-stack)
- [Project Architecture](#-project-architecture)
- [Installation & Setup](#-installation--setup)
- [API Documentation](#-api-documentation)
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
- 🔍 **Search & Filters** – Full-text search over name/description, plus location, district, state, and tag filters (server-side)
- ⭐ **Ratings & Reviews** – Read reviews and post a 1–5 star rating with a comment; one review per user per place (enforced by a `UNIQUE` constraint + upsert), with place averages maintained by a PostgreSQL trigger
- 📱 **Responsive Design** – Optimized for all devices
- 🖼️ **Magazine-Style Detail Pages** – Full-bleed hero, carousels, related places, and a Google Maps embed for the location
- 🔐 **Accounts** – Firebase email/password + Google sign-in, with an editable display name

### 🛡️ Admin Features

- 🖊️ **Content Management** – Create, edit, and delete destinations
- 📦 **Image Management** – Cloudinary-backed upload with a drag-and-drop admin UI and an SVG placeholder fallback
- 👥 **Admin Management API** – List, grant, and revoke admin rights (`/api/admin/admins`) — API only, no UI yet

---

## 🧭 Not Yet Implemented

Built-but-incomplete or not started. Listed here so the feature list above stays honest.

| Feature                      | Status today                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🗺️ Explore map (browse page) | The Leaflet UI is fully built — clustering, six tile layers, a geolocation radius filter, in-map search — but it renders **no markers**: PostgreSQL returns `DECIMAL` coordinates as strings and the marker filter requires `typeof === 'number'` |
| ❤️ Favorites / wishlist      | Heart buttons exist in the UI but persist to component state only — there is no `favorites` table or endpoint                                                                                                                                     |
| 📖 Multi-image galleries     | The `place_images` table, its read endpoint, and the gallery UI exist, but nothing writes to the table yet                                                                                                                                        |
| ☀️ Weather information       | The weather widget on the detail page (preview 7) renders **placeholder values** — no weather API is wired up                                                                                                                                     |
| 📝 Review moderation         | No moderation endpoints or queue; "report review" is a client-side stub                                                                                                                                                                           |
| 📊 Analytics dashboard       | The admin dashboard is a set of static navigation tiles — no metrics are computed                                                                                                                                                                 |
| 👥 Admin user-management UI  | The backend API works, but the dashboard's "User Management" and "Settings" tiles link to pages that do not exist yet                                                                                                                             |
| 🧪 Tests & CI                | No test suite and no CI pipeline in this repository yet                                                                                                                                                                                           |
| ✉️ Email verification        | Password reset works, but a new account's address is never confirmed                                                                                                                                                                              |
| ⚡ Google One Tap            | Deliberately removed — it was configured with a Firebase API key where a Google OAuth Client ID belongs, so it could never work. Google **popup** sign-in is supported                                                                            |

---

## 🛠️ Technology Stack

### 🎨 Frontend

- **Next.js 13.4** - React framework, **Pages Router** (`frontend/src/pages`); public pages are client-rendered, admin pages are gated in `getServerSideProps`
- **React 18.2** - Modern React with hooks and context
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library for smooth interactions
- **Leaflet + markercluster** - Explore map on the browse page (see [Not Yet Implemented](#-not-yet-implemented))
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
├── backend/                  # Node.js + Express API
│   ├── app.js                # Entry point: CORS, routes, health check, pg pool
│   ├── script/make-admin.js  # CLI to grant admin rights
│   └── src/
│       ├── config/           # db, cloudinary, firebase, schema.sql
│       ├── controllers/      # Request handling / business logic
│       ├── models/           # SQL data access (parameterized queries)
│       ├── routes/           # Express routers
│       ├── services/         # Service helpers
│       └── utils/            # Auth middleware & helpers
│
└── frontend/                 # Next.js app (Pages Router)
    ├── public/               # Static assets
    └── src/
        ├── components/       # UI components
        ├── config/           # Firebase client config
        ├── context/          # Auth / user context
        ├── hooks/            # Custom hooks
        ├── pages/            # Routes (incl. pages/api image helpers)
        ├── services/         # API clients (axios)
        ├── styles/           # Global styles
        └── utils/            # Utilities
```

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

# Database — discrete vars, still read by src/config/db.js (admin/user models)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=easytrip

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

> Both `DATABASE_URL` and the `POSTGRES_*` set are currently required: most queries use the
> `DATABASE_URL` pool, while `src/config/db.js` (used by the admin/user models) builds its pool
> from the discrete variables. Consolidating onto a single shared pool is a known cleanup item.

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
| GET    | `/health` | —    | Service + database status |

### Places

| Method | Endpoint                      | Auth   | Description                                                             |
| ------ | ----------------------------- | ------ | ----------------------------------------------------------------------- |
| GET    | `/places`                     | —      | List all places                                                         |
| GET    | `/places/search`              | —      | Search / filter (`searchTerm`, `location`, `district`, `state`, `tags`) |
| GET    | `/places/locations`           | —      | Distinct locations                                                      |
| GET    | `/places/districts`           | —      | Distinct districts                                                      |
| GET    | `/places/states`              | —      | Distinct states                                                         |
| GET    | `/places/tags`                | —      | Distinct tags                                                           |
| GET    | `/places/:id`                 | —      | Get place by ID                                                         |
| GET    | `/places/:id/image`           | —      | Primary image (redirect/proxy, with placeholder fallback)               |
| GET    | `/places/:id/images`          | —      | Gallery images for a place                                              |
| GET    | `/places/:id/images/:imageId` | —      | Same handler as `/places/:id/image`                                     |
| GET    | `/places/:id/reviews`         | —      | Reviews for a place                                                     |
| POST   | `/places/:id/reviews`         | Bearer | Create a review — body `{ rating: 1-5, comment: string }`               |

### Profile

| Method | Endpoint            | Auth   | Description                            |
| ------ | ------------------- | ------ | -------------------------------------- |
| GET    | `/auth/profile`     | Bearer | Get the signed-in user's profile row   |
| PUT    | `/auth/profile`     | Bearer | Update the signed-in user's profile    |
| GET    | `/auth/check-admin` | Bearer | Whether the signed-in user is an admin |

### Admin

| Method | Endpoint               | Auth  | Description                                           |
| ------ | ---------------------- | ----- | ----------------------------------------------------- |
| POST   | `/admin/places`        | Admin | Create a place (`multipart/form-data`, field `image`) |
| PUT    | `/admin/places/:id`    | Admin | Update a place (`multipart/form-data`, field `image`) |
| DELETE | `/admin/places/:id`    | Admin | Delete a place                                        |
| GET    | `/admin/admins`        | Admin | List admin accounts                                   |
| POST   | `/admin/admins`        | Admin | Grant admin rights                                    |
| DELETE | `/admin/admins/:email` | Admin | Revoke admin rights                                   |

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

## 🚀 Deployment

Deployment is manual — there is no CI/CD pipeline in this repository yet.

- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Managed PostgreSQL

No public demo URL is published here yet; the screenshots above are from a local run.

---

## 🤝 Contributing

1. Fork the repo
2. Create a new branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m "Add amazing feature"`
4. Push branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

No license file has been added to this repository yet. The `package.json` manifests declare
`ISC`; a matching `LICENSE` file still needs to be committed before that declaration means anything.
Until then, treat the code as all-rights-reserved.

---

## 📞 Contact

EasyTrip is a **two-person team project**, not the work of a single author.

**Project Maintainers**  
👤 Dharmendra — [@dharmendra23101](https://github.com/dharmendra23101)  
👤 Mukund Thakur — [@Mukund934](https://github.com/Mukund934)

## 🗺️ Roadmap

Near-term work is listed in [Not Yet Implemented](#-not-yet-implemented). The items below are
longer-term ideas, none of which have been started.

### Upcoming Features

- [ ] Mobile app (React Native)
- [ ] Trip planning and itinerary builder
- [ ] Social features and user connections
- [ ] Advanced recommendation engine
- [ ] Multi-language support
- [ ] Offline mode support
- [ ] Integration with booking platforms
- [ ] Weather information integration
- [ ] Travel blog and stories feature
- [ ] Augmented reality features

---

✨ _Happy Traveling with EasyTrip!_ 🌍✈️

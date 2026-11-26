# GoodTable

GoodTable helps restaurants, hostels and event kitchens forecast surplus food, then connect it with nearby community organizations before it expires.

## What works in this MVP

- React dashboard for surplus listings, pickup windows, community partners and impact.
- Python forecast service estimates servings to share from prepared servings and expected demand, with an urgency-aware pickup recommendation.
- Node.js API stores listings in PostgreSQL and ranks registered charities by straight-line distance from the donor.
- Claiming a listing is transactional, so two organizations cannot claim the same available food.
- Seeded Bengaluru demo organizations and listings make the dashboard ready to explore.

The forecast is an explainable baseline, not a trained demand model. It uses the kitchen's prepared-serving and expected-demand estimates; collecting historical forecasts and actual sales is the next step toward a learned model. Distance matching currently uses organization coordinates and does not require a maps API key.

This is a single-tenant demo seeded with one donor and three community partners. Authentication, organization onboarding, real map tiles/geocoding and production authorization still need to be added before deployment with real organizations or personal data.

## Run with Docker

From the project directory:

```sh
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:4000/api/health](http://localhost:4000/api/health); forecast health is at [http://localhost:8000/health](http://localhost:8000/health).

PostgreSQL initializes its schema and sample data on the first run. To reset the demo database, stop the stack and remove the `goodtable-data` volume before starting it again.

## Run locally

Requirements: Node.js 20+, Python 3.12+, and PostgreSQL 16+.

1. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if needed.
2. Apply `server/schema.sql` and `server/seed.sql` to the database.
3. Install Node dependencies with `npm install`.
4. Start the forecast service from `services/forecast`:

   ```sh
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

5. In another terminal, run `npm run dev`. The web app is at [http://localhost:5173](http://localhost:5173), and its `/api` requests are proxied to the Node API.

## Main API routes

- `GET /api/health` — database-backed API health check.
- `GET /api/dashboard` — listings, partner organizations, distance-ranked matches and summary counts.
- `POST /api/listings` — forecast and create a surplus listing.
- `POST /api/listings/:id/claim` — atomically reserve a listing for a registered charity.
- `POST /api/listings/:id/complete` — confirm that a claimed donation was picked up.

## Project layout

- `src/` — React application and responsive UI.
- `server/` — Express API, PostgreSQL schema and demo seed data.
- `services/forecast/` — Python/FastAPI surplus forecast.

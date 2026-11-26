import "dotenv/config";
import cors from "cors";
import express from "express";
import { pool } from "./pool.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const forecastUrl = process.env.FORECAST_URL || "http://localhost:8000";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function distanceKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validateListing(body) {
  const requiredText = ["name", "category", "availableUntil"];
  for (const field of requiredText) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return `${field} is required`;
    }
  }
  if (!Number.isInteger(body.preparedServings) || body.preparedServings < 1) {
    return "preparedServings must be a positive whole number";
  }
  if (!Number.isInteger(body.expectedDemand) || body.expectedDemand < 0) {
    return "expectedDemand must be a non-negative whole number";
  }
  const availableUntil = new Date(body.availableUntil);
  if (Number.isNaN(availableUntil.getTime()) || availableUntil <= new Date()) {
    return "availableUntil must be a future date and time";
  }
  return null;
}

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (_request, response, next) => {
  try {
    const [listingResult, organizationResult, statsResult] = await Promise.all([
      pool.query(`
        SELECT l.id, l.name, l.category, l.predicted_servings, l.prepared_servings,
               l.expected_demand, l.confidence, l.recommended_pickup_minutes,
               l.available_until, l.status, l.notes, l.claimed_by,
               donor.name AS donor_name, donor.address AS donor_address,
               donor.latitude AS donor_latitude, donor.longitude AS donor_longitude,
               recipient.name AS claimed_by_name
        FROM listings l
        JOIN organizations donor ON donor.id = l.donor_id
        LEFT JOIN organizations recipient ON recipient.id = l.claimed_by
        WHERE l.available_until > NOW() OR l.status != 'available'
        ORDER BY CASE WHEN l.status = 'available' THEN 0 ELSE 1 END,
                 l.available_until ASC
      `),
      pool.query(`
        SELECT id, name, address, latitude, longitude
        FROM organizations WHERE type = 'charity' ORDER BY name
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'available' AND available_until > NOW())::int AS active_listings,
          COALESCE(SUM(predicted_servings) FILTER (WHERE status = 'available' AND available_until > NOW()), 0)::int AS at_risk_servings,
          COALESCE(SUM(predicted_servings) FILTER (WHERE status = 'completed'), 0)::int AS shared_servings,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_pickups,
          (SELECT COUNT(*)::int FROM organizations WHERE type = 'charity') AS partner_count
        FROM listings
      `),
    ]);

    const partners = organizationResult.rows;
    const listings = listingResult.rows.map((listing) => {
      const location = {
        latitude: listing.donor_latitude,
        longitude: listing.donor_longitude,
      };
      const matches = partners
        .map((partner) => ({
          id: partner.id,
          name: partner.name,
          address: partner.address,
          distanceKm: Number(distanceKm(location, partner).toFixed(1)),
        }))
        .filter((partner) => partner.distanceKm <= 25)
        .sort((left, right) => left.distanceKm - right.distanceKm)
        .slice(0, 3);
      return { ...listing, matches };
    });

    response.json({
      listings,
      partners: partners.map(({ latitude, longitude, ...partner }) => partner),
      stats: statsResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/listings", async (request, response, next) => {
  const validationError = validateListing(request.body);
  if (validationError) {
    return response.status(400).json({ error: validationError });
  }

  try {
    let forecastResponse;
    try {
      forecastResponse = await fetch(`${forecastUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prepared_servings: request.body.preparedServings,
          expected_demand: request.body.expectedDemand,
          available_until: request.body.availableUntil,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      return response.status(503).json({
        error: "Forecast service is unavailable. Start the forecast service and try again.",
      });
    }

    if (!forecastResponse.ok) {
      const detail = await forecastResponse.text();
      return response.status(502).json({
        error: `Forecast service returned an error: ${detail.slice(0, 300)}`,
      });
    }

    const forecast = await forecastResponse.json();
    if (!Number.isInteger(forecast.predicted_surplus) || forecast.predicted_surplus < 1) {
      return response.status(422).json({
        error: "The forecast found no surplus servings to list.",
      });
    }

    const result = await pool.query(
      `INSERT INTO listings
        (donor_id, name, category, predicted_servings, prepared_servings,
         expected_demand, confidence, recommended_pickup_minutes,
         available_until, notes)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, category, predicted_servings, prepared_servings,
                 expected_demand, confidence, recommended_pickup_minutes,
                 available_until, status, notes`,
      [
        request.body.name.trim(),
        request.body.category.trim(),
        forecast.predicted_surplus,
        request.body.preparedServings,
        request.body.expectedDemand,
        forecast.confidence,
        forecast.recommended_pickup_minutes,
        request.body.availableUntil,
        typeof request.body.notes === "string" ? request.body.notes.trim() : "",
      ],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/listings/:id/claim", async (request, response, next) => {
  const listingId = Number(request.params.id);
  const charityId = Number(request.body.charityId);
  if (!Number.isInteger(listingId) || listingId < 1 || !Number.isInteger(charityId) || charityId < 1) {
    return response.status(400).json({ error: "A valid listing id and charityId are required" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const listingResult = await client.query(
      "SELECT id, status, available_until FROM listings WHERE id = $1 FOR UPDATE",
      [listingId],
    );
    if (listingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Listing not found" });
    }
    const listing = listingResult.rows[0];
    if (listing.status !== "available" || new Date(listing.available_until) <= new Date()) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: "This food is no longer available to claim" });
    }
    const charityResult = await client.query(
      "SELECT id FROM organizations WHERE id = $1 AND type = 'charity'",
      [charityId],
    );
    if (charityResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "Choose a registered community organization" });
    }
    const updateResult = await client.query(
      `UPDATE listings SET status = 'claimed', claimed_by = $2
       WHERE id = $1
       RETURNING id, name, status, claimed_by`,
      [listingId, charityId],
    );
    await client.query("COMMIT");
    response.json(updateResult.rows[0]);
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        return next(rollbackError);
      }
    }
    next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/listings/:id/complete", async (request, response, next) => {
  const listingId = Number(request.params.id);
  if (!Number.isInteger(listingId) || listingId < 1) {
    return response.status(400).json({ error: "A valid listing id is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE listings SET status = 'completed'
       WHERE id = $1 AND status = 'claimed'
       RETURNING id, name, status, claimed_by`,
      [listingId],
    );
    if (result.rowCount === 0) {
      const exists = await pool.query("SELECT id, status FROM listings WHERE id = $1", [listingId]);
      if (exists.rowCount === 0) {
        return response.status(404).json({ error: "Listing not found" });
      }
      return response.status(409).json({ error: "Only a claimed listing can be marked as picked up" });
    }
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "The server could not complete this request" });
});

app.listen(port, () => {
  console.log(`GoodTable API listening on http://localhost:${port}`);
});

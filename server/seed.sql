INSERT INTO organizations (id, name, type, address, latitude, longitude, email) VALUES
  (1, 'Greenhouse Kitchen', 'donor', '14 Indiranagar, Bengaluru', 12.9719, 77.6412, 'hello@greenhouse.example'),
  (2, 'Open Arms Community Table', 'charity', '100 Feet Road, Bengaluru', 12.9788, 77.6408, 'team@openarms.example'),
  (3, 'Sunrise Shelter', 'charity', 'Domlur, Bengaluru', 12.9604, 77.6387, 'care@sunrise.example'),
  (4, 'Neighbourhood Food Circle', 'charity', 'HAL 2nd Stage, Bengaluru', 12.9691, 77.6512, 'connect@foodcircle.example')
ON CONFLICT (email) DO NOTHING;

SELECT setval(pg_get_serial_sequence('organizations', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM organizations), 1));

INSERT INTO listings
  (id, donor_id, claimed_by, name, category, predicted_servings, prepared_servings, expected_demand, confidence, recommended_pickup_minutes, available_until, status, notes)
VALUES
  (1, 1, NULL, 'Seasonal vegetable bowls', 'Prepared meals', 18, 54, 36, 0.88, 25, NOW() + INTERVAL '2 hours', 'available', 'Packed individually. Contains sesame.'),
  (2, 1, NULL, 'Fresh sourdough loaves', 'Bakery', 12, 24, 12, 0.81, 40, NOW() + INTERVAL '4 hours', 'available', 'Baked this morning.'),
  (3, 1, NULL, 'Lentil & spinach curry', 'Prepared meals', 14, 42, 28, 0.91, 20, NOW() + INTERVAL '90 minutes', 'available', 'Vegetarian; contains no nuts.'),
  (4, 1, 3, 'Mixed fruit boxes', 'Produce', 10, 30, 20, 0.84, 30, NOW() + INTERVAL '3 hours', 'claimed', 'Ready for collection at the front desk.'),
  (5, 1, 2, 'Garden herb focaccia', 'Bakery', 8, 24, 16, 0.79, 35, NOW() - INTERVAL '1 day', 'completed', 'Collected by Open Arms Community Table.')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('listings', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM listings), 1));

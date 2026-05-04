-- ============================================================
-- FleetFlow Premium – Seed Demo Data
-- Run AFTER schema.sql. Creates demo users and sample records.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Demo users (create via Supabase Auth API or Dashboard first,
-- then insert profiles below with matching UUIDs)
-- For local dev, these UUIDs are placeholders – replace with
-- actual auth.users ids after signing up.
-- ─────────────────────────────────────────────────────────────

-- Demo Profiles (adjust UUIDs to match auth.users after signup)
INSERT INTO public.profiles (id, email, full_name, role, department, phone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@fleetflow.demo', 'Alexandra Chen', 'admin', 'Operations', '+1 555-0100'),
  ('00000000-0000-0000-0000-000000000002', 'manager@fleetflow.demo', 'Marcus Johnson', 'manager', 'Transport', '+1 555-0101'),
  ('00000000-0000-0000-0000-000000000003', 'staff@fleetflow.demo', 'Priya Patel', 'staff', 'Guest Relations', '+1 555-0102'),
  ('00000000-0000-0000-0000-000000000004', 'finance@fleetflow.demo', 'David Kim', 'finance', 'Finance', '+1 555-0103')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Suppliers
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.suppliers (id, company_name, contact_person, phone, email, vehicle_types, base_rate_usd, rating, total_bookings, is_available, is_preferred, notes) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Premier Limo Services', 'James Walker', '+1 555-2001', 'james@premierlimo.demo', ARRAY['luxury','sedan']::vehicle_type[], 120.00, 4.8, 45, true, true, 'Top-tier luxury fleet, punctual, English-speaking drivers'),
  ('10000000-0000-0000-0000-000000000002', 'CityDrive Rentals', 'Sofia Martinez', '+1 555-2002', 'sofia@citydrive.demo', ARRAY['sedan','suv','van']::vehicle_type[], 65.00, 4.5, 132, true, false, 'Large fleet, competitive pricing, 24/7 availability'),
  ('10000000-0000-0000-0000-000000000003', 'Executive Transport Co.', 'Robert Chen', '+1 555-2003', 'robert@exectransport.demo', ARRAY['luxury','suv','sedan']::vehicle_type[], 150.00, 4.9, 28, true, true, 'VIP specialist, airport meet & greet, multilingual staff'),
  ('10000000-0000-0000-0000-000000000004', 'Budget Fleet Solutions', 'Anna Kowalski', '+1 555-2004', 'anna@budgetfleet.demo', ARRAY['sedan','van','minibus']::vehicle_type[], 45.00, 3.8, 87, true, false, 'Economy option, best for groups, advance booking required'),
  ('10000000-0000-0000-0000-000000000005', 'GreenRide Eco Transport', 'Liam Nguyen', '+1 555-2005', 'liam@greenride.demo', ARRAY['sedan','suv']::vehicle_type[], 80.00, 4.3, 61, true, false, 'Electric/hybrid fleet, eco-conscious option'),
  ('10000000-0000-0000-0000-000000000006', 'Metro Van & Minibus', 'Chen Wei', '+1 555-2006', 'wei@metrotransport.demo', ARRAY['van','minibus','pickup']::vehicle_type[], 95.00, 4.1, 39, false, false, 'Specialist for large groups, airport transfers')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Bookings
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.bookings (id, reference, guest_name, guest_nationality, guest_count, pickup_datetime, dropoff_datetime, pickup_location, dropoff_location, vehicle_type, driver_required, budget_usd, final_cost_usd, status, notes, assigned_supplier, created_by) VALUES
  ('20000000-0000-0000-0000-000000000001', 'FF-A1B2C3D4', 'Hiroshi Tanaka', 'Japanese', 2, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 4 hours', 'JFK International Airport', 'Midtown Manhattan Hotel', 'luxury', true, 300.00, 270.00, 'approved', 'VIP delegate, requires premium sedan', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000002', 'FF-E5F6G7H8', 'Emma Schmidt', 'German', 1, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 2 hours', 'LaGuardia Airport', 'Brooklyn Conference Center', 'sedan', false, 150.00, NULL, 'quoted', 'Regular business trip', NULL, '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000003', 'FF-I9J0K1L2', 'Carlos Mendoza', 'Mexican', 8, NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 6 hours', 'Newark Airport', 'Manhattan Business District', 'minibus', true, 500.00, NULL, 'pending', 'Corporate delegation, need minibus with luggage space', NULL, '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000004', 'FF-M3N4O5P6', 'Aisha Al-Hassan', 'UAE', 3, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '3 hours', 'JFK International Airport', 'Upper East Side Residence', 'suv', true, 400.00, 380.00, 'completed', 'High-value guest, Arabic-speaking driver requested', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000005', 'FF-Q7R8S9T0', 'Yuki Nakamura', 'Japanese', 4, NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days 5 hours', 'JFK International Airport', 'Hoboken Conference Venue', 'van', true, 350.00, NULL, 'pending', 'Needs WiFi-equipped vehicle', NULL, '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000006', 'FF-U1V2W3X4', 'Sophie Dubois', 'French', 1, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '2 hours', 'LaGuardia Airport', 'Times Square Hotel', 'sedan', false, 120.00, 105.00, 'completed', NULL, '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000007', 'FF-Y5Z6A7B8', 'Liu Wei', 'Chinese', 6, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours', 'JFK International Airport', 'Financial District Hotel', 'van', true, 420.00, NULL, 'quoted', 'Tech executive group, needs charging ports', NULL, '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000008', 'FF-C9D0E1F2', 'Ahmed Hassan', 'Egyptian', 2, NOW() - INTERVAL '2 days', NULL, 'Newark Airport', 'Princeton University', 'sedan', true, 200.00, NULL, 'cancelled', 'Guest cancelled trip', NULL, '00000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Quotes
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.quotes (booking_id, supplier_id, amount_usd, includes_driver, vehicle_model, estimated_duration_hours, notes, is_selected) VALUES
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 145.00, false, 'Mercedes E-Class', 2.0, 'Premium option', false),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 85.00, false, 'Toyota Camry', 2.0, 'Economy option', false),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 95.00, false, 'Tesla Model 3', 2.0, 'Eco option', false),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 280.00, true, 'Toyota Hiace', 4.0, 'Standard van', false),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004', 240.00, true, 'Ford Transit', 4.0, 'Budget option', false)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Approvals
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.approvals (booking_id, reviewer_id, action, comments) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'approved', 'Approved. VIP booking confirmed with Executive Transport Co.'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'approved', 'Approved for Premier Limo Services. High-value guest handled well.')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.notifications (user_id, type, title, message, booking_id, is_read) VALUES
  ('00000000-0000-0000-0000-000000000002', 'approval_needed', 'New Booking Requires Approval', 'Booking FF-E5F6G7H8 for Emma Schmidt is ready for your review.', '20000000-0000-0000-0000-000000000002', false),
  ('00000000-0000-0000-0000-000000000002', 'approval_needed', 'New Booking Requires Approval', 'Booking FF-Y5Z6A7B8 for Liu Wei group has been quoted and awaits approval.', '20000000-0000-0000-0000-000000000007', false),
  ('00000000-0000-0000-0000-000000000003', 'approved', 'Booking Approved', 'Your booking FF-A1B2C3D4 for Hiroshi Tanaka has been approved!', '20000000-0000-0000-0000-000000000001', false),
  ('00000000-0000-0000-0000-000000000004', 'payment_due', 'Payment Due Reminder', 'Booking FF-A1B2C3D4 invoice of $270 is due within 7 days.', '20000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000001', 'new_request', 'New Booking Submitted', 'Priya submitted a new booking for Carlos Mendoza group (8 guests).', '20000000-0000-0000-0000-000000000003', false)
ON CONFLICT DO NOTHING;

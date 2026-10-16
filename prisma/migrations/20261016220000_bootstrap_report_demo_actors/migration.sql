-- The current citizen and officer UIs use fixed demo identities until real
-- authentication is connected. Keep those foreign-key parents available in
-- every migrated environment, including Vercel production.
INSERT INTO "district" ("id", "name", "created_at", "updated_at")
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Colombo District (Legacy)',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "citizen" (
  "id",
  "name",
  "district_id",
  "is_volunteer",
  "created_at",
  "updated_at"
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Demo Citizen',
  '550e8400-e29b-41d4-a716-446655440000',
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "officer" (
  "id",
  "name",
  "role",
  "district_id",
  "created_at",
  "updated_at"
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Test Duty Officer',
  'DUTY_OFFICER',
  '550e8400-e29b-41d4-a716-446655440000',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "district_id" = EXCLUDED."district_id",
  "updated_at" = CURRENT_TIMESTAMP;

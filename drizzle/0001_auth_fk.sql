-- Link each flat to its Neon Auth user. Neon Auth owns neon_auth."user", so this
-- foreign key is written by hand instead of being declared in src/db/schema.ts.
ALTER TABLE "flats" ADD CONSTRAINT "flats_user_id_neon_auth_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;

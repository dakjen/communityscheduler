-- Add weekly_hours column (nullable for now to backfill)
ALTER TABLE "rooms" ADD COLUMN "weekly_hours" text;
--> statement-breakpoint

-- Backfill existing rooms: apply current open/close to all 7 days
UPDATE "rooms" SET "weekly_hours" = (
  '{"mon":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false},' ||
  '"tue":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false},' ||
  '"wed":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false},' ||
  '"thu":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false},' ||
  '"fri":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false},' ||
  '"sat":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false},' ||
  '"sun":{"open":"' || "open_time" || '","close":"' || "close_time" || '","closed":false}}'
);
--> statement-breakpoint

-- Now lock it down and drop the legacy columns
ALTER TABLE "rooms" ALTER COLUMN "weekly_hours" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "open_time";
--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "close_time";
--> statement-breakpoint

-- Laptops + laptop bookings
CREATE TABLE "laptops" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	CONSTRAINT "laptops_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "laptop_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"laptop_id" integer NOT NULL,
	"user_id" varchar(256),
	"customer_name" varchar(256) NOT NULL,
	"customer_email" varchar(256) NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"id_agreed" boolean NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "laptop_bookings" ADD CONSTRAINT "laptop_bookings_laptop_id_laptops_id_fk" FOREIGN KEY ("laptop_id") REFERENCES "public"."laptops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Seed 10 numbered laptops
INSERT INTO "laptops" ("number") VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);
--> statement-breakpoint

-- Seed default laptop hours (Mon-Sun 09:00-17:00) into settings
INSERT INTO "settings" ("key", "value") VALUES (
  'laptopHours',
  '{"mon":{"open":"09:00","close":"17:00","closed":false},"tue":{"open":"09:00","close":"17:00","closed":false},"wed":{"open":"09:00","close":"17:00","closed":false},"thu":{"open":"09:00","close":"17:00","closed":false},"fri":{"open":"09:00","close":"17:00","closed":false},"sat":{"open":"09:00","close":"17:00","closed":false},"sun":{"open":"09:00","close":"17:00","closed":false}}'
) ON CONFLICT ("key") DO NOTHING;

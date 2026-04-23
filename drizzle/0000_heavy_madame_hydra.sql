CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(256) NOT NULL,
	"password" varchar(256) NOT NULL,
	"full_name" varchar(256),
	"email" varchar(256),
	"role" varchar DEFAULT 'admin' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"office_hours" text,
	"bio" text,
	"service_type" varchar(256),
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "appointment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" varchar(256) NOT NULL,
	"customer_email" varchar(256) NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"business_name" varchar(256),
	"preferred_date" varchar(50) NOT NULL,
	"preferred_time" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"preferred_staff_username" varchar(256),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" varchar(256),
	"customer_name" varchar(256) NOT NULL,
	"customer_email" varchar(256) NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"organization" varchar(256),
	"purpose" text NOT NULL,
	"need_pcc_help" boolean DEFAULT false NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" varchar DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"responsible_party" varchar(256) NOT NULL,
	"date" varchar(50) NOT NULL,
	"time" varchar(50) NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_pattern" text,
	"attendees" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"capacity" integer NOT NULL,
	"image_url" text,
	"open_time" varchar(5) DEFAULT '09:00' NOT NULL,
	"close_time" varchar(5) DEFAULT '17:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(256) PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
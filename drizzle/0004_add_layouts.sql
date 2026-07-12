CREATE TABLE IF NOT EXISTS "layouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_key" text NOT NULL,
	"items" jsonb NOT NULL,
	"layout" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

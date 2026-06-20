CREATE TABLE "heatmaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"market" text NOT NULL,
	"sectors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"ticker" text NOT NULL,
	"exchange" text,
	"direction" text,
	"thesis" text,
	"metrics" jsonb,
	"entry_low" double precision,
	"entry_high" double precision,
	"stop_loss" double precision,
	"target_1" double precision,
	"target_2" double precision,
	"risk_reward_h1" double precision,
	"note" text,
	"risk_note" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morning_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"top_call" text,
	"macro_bullets" jsonb,
	"sector_deep_dive" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"exchange" text,
	"current_price" double precision,
	"entry_low" double precision,
	"entry_high" double precision,
	"tp1" double precision,
	"tp2" double precision,
	"tp3" double precision,
	"hard_sl" double precision,
	"thesis" text,
	"invalidation" text,
	"price_history" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

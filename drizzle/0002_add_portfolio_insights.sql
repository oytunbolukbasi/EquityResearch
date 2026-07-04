CREATE TABLE "portfolio_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

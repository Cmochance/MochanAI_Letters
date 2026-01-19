CREATE TABLE "user_credentials" (
	"userId" integer PRIMARY KEY NOT NULL,
	"algorithm" varchar(32) NOT NULL,
	"salt" text NOT NULL,
	"passwordHash" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "brew_photos" (
	"brew_id" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"method" text NOT NULL,
	"method_other" text,
	"bean_name" text NOT NULL,
	"roaster" text,
	"roast_date" text,
	"grind_size" text NOT NULL,
	"dose_grams" double precision NOT NULL,
	"water_ml" double precision NOT NULL,
	"water_temp_c" double precision NOT NULL,
	"brew_time_seconds" integer NOT NULL,
	"notes" text,
	"rating" integer NOT NULL,
	"tds_percent" double precision,
	"has_photo" boolean DEFAULT false NOT NULL,
	"brewed_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"resets_at" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"method" text NOT NULL,
	"method_other" text,
	"bean_name" text,
	"roaster" text,
	"grind_size" text,
	"dose_grams" double precision,
	"water_ml" double precision,
	"water_temp_c" double precision,
	"brew_time_seconds" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"token_version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "brew_photos" ADD CONSTRAINT "brew_photos_brew_id_brews_id_fk" FOREIGN KEY ("brew_id") REFERENCES "public"."brews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brews" ADD CONSTRAINT "brews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brews_user_brewed_at_idx" ON "brews" USING btree ("user_id","brewed_at");--> statement-breakpoint
CREATE INDEX "brews_method_idx" ON "brews" USING btree ("method");--> statement-breakpoint
CREATE INDEX "brews_bean_name_idx" ON "brews" USING btree ("bean_name");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_user_name_idx" ON "recipes" USING btree ("user_id","name");
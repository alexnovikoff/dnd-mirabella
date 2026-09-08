CREATE TYPE "public"."entry_kind" AS ENUM('moment', 'quote', 'note', 'image');--> statement-breakpoint
CREATE TYPE "public"."image_kind" AS ENUM('art', 'map', 'screenshot');--> statement-breakpoint
CREATE TYPE "public"."link_kind" AS ENUM('mention', 'manual');--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('character', 'npc', 'faction', 'location', 'artifact', 'event', 'rumor');--> statement-breakpoint
CREATE TYPE "public"."node_status" AS ENUM('open', 'resolved', 'dead_end');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('player', 'dm');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'draft', 'private', 'dm_only');--> statement-breakpoint
CREATE TABLE "board_positions" (
	"node_id" text PRIMARY KEY NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"seal" text DEFAULT '?' NOT NULL,
	"setting" text,
	"eyebrow" text,
	"tagline" text
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"node_id" text PRIMARY KEY NOT NULL,
	"race" text,
	"classes" text,
	"level" integer,
	"portrait" text,
	"bio" text,
	"is_pc" boolean DEFAULT true NOT NULL,
	"player_id" text,
	"since_session" integer
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"session_id" text,
	"kind" "entry_kind" NOT NULL,
	"title" text,
	"body" text,
	"author_id" text,
	"subject_id" text,
	"roll" integer,
	"is_crit" boolean DEFAULT false NOT NULL,
	"is_fail" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"session_id" text,
	"entry_id" text,
	"url" text,
	"caption" text,
	"uploader_id" text,
	"kind" "image_kind" DEFAULT 'art' NOT NULL,
	"is_key" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"kind" "link_kind" NOT NULL,
	"from_node_id" text,
	"from_entry_id" text,
	"to_node_id" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_exactly_one_source" CHECK (("links"."from_node_id" is null) <> ("links"."from_entry_id" is null))
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"kind" "node_kind" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "node_status",
	"aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"first_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_campaign_slug" UNIQUE("campaign_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"number" integer NOT NULL,
	"date" date,
	"title" text,
	"location" text,
	CONSTRAINT "sessions_campaign_number" UNIQUE("campaign_id","number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"initial" text NOT NULL,
	"role" "role" DEFAULT 'player' NOT NULL,
	"password_hash" text
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"entry_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_entry_id_user_id_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "board_positions" ADD CONSTRAINT "board_positions_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_subject_id_nodes_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_from_node_id_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_from_entry_id_entries_id_fk" FOREIGN KEY ("from_entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_to_node_id_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_first_session_id_sessions_id_fk" FOREIGN KEY ("first_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_campaign_created" ON "entries" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "entries_session" ON "entries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "images_session" ON "images" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "links_to" ON "links" USING btree ("to_node_id");--> statement-breakpoint
CREATE INDEX "links_from_node" ON "links" USING btree ("from_node_id");--> statement-breakpoint
CREATE INDEX "links_from_entry" ON "links" USING btree ("from_entry_id");--> statement-breakpoint
CREATE INDEX "nodes_campaign_kind" ON "nodes" USING btree ("campaign_id","kind");
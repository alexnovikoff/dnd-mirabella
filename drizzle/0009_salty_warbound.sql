ALTER TABLE "links" DROP CONSTRAINT "links_exactly_one_source";--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "from_session_id" text;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_from_session_id_sessions_id_fk" FOREIGN KEY ("from_session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "links_from_session" ON "links" USING btree ("from_session_id");--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_exactly_one_source" CHECK (num_nonnulls("links"."from_node_id", "links"."from_entry_id", "links"."from_session_id") = 1);
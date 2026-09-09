ALTER TYPE "public"."image_kind" ADD VALUE 'achievement';--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "node_id" text;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "images_node" ON "images" USING btree ("node_id");
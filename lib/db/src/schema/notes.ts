import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { personas } from "./personas";

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  sourceUrl: text("source_url"),
  sourceText: text("source_text").notNull(),
  response: text("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

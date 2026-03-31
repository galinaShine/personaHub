import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { personas } from "./personas";

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  sessionId: text("session_id").unique(),
  messages: jsonb("messages").notNull(),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Interview = typeof interviews.$inferSelect;

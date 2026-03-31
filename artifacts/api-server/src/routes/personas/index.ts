import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { personas, notes, interviews } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../../middlewares/auth";
import { PERSONAS, buildSystemPrompt, normalizePersonaData, type PersonaData, type ContextNote, type OpinionNote } from "../../lib/personas";
import {
  UpsertPersonaBody,
  AddPersonaNoteBody,
  GeneratePersonaOpinionBody,
  InterviewPersonaBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatNote(n: typeof notes.$inferSelect) {
  return {
    id: n.id,
    personaId: n.personaId,
    type: n.type,
    sourceUrl: n.sourceUrl ?? null,
    sourceText: n.sourceText,
    response: n.response ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: personas.id,
      name: personas.name,
      role: personas.role,
      company: personas.company,
      data: personas.data,
      createdAt: personas.createdAt,
    })
    .from(personas)
    .orderBy(personas.createdAt);

  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      company: p.company,
      data: p.data,
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

router.get("/:id", async (req: Request, res: Response) => {
  const [persona] = await db.select().from(personas).where(eq(personas.id, req.params.id));
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const personaNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.personaId, req.params.id))
    .orderBy(notes.createdAt);

  res.json({
    id: persona.id,
    name: persona.name,
    role: persona.role,
    company: persona.company,
    data: persona.data,
    notes: personaNotes.map(formatNote),
    createdAt: persona.createdAt.toISOString(),
  });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = UpsertPersonaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { id, name, role, company, data } = parsed.data;

  const [upserted] = await db
    .insert(personas)
    .values({ id, name, role, company, data: data as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: personas.id,
      set: { name, role, company, data: data as Record<string, unknown>, updatedAt: new Date() },
    })
    .returning();

  res.json({
    id: upserted.id,
    name: upserted.name,
    role: upserted.role,
    company: upserted.company,
    createdAt: upserted.createdAt.toISOString(),
  });
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const deleted = await db.delete(personas).where(eq(personas.id, req.params.id)).returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }
  res.status(204).send();
});

router.get("/:id/notes", async (req: Request, res: Response) => {
  const [persona] = await db
    .select({ id: personas.id })
    .from(personas)
    .where(eq(personas.id, req.params.id));
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const personaNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.personaId, req.params.id))
    .orderBy(notes.createdAt);

  res.json(personaNotes.map(formatNote));
});

router.delete("/:id/notes/:noteId", requireAuth, async (req: Request, res: Response) => {
  const noteId = parseInt(req.params.noteId, 10);
  if (isNaN(noteId)) {
    res.status(400).json({ error: "Invalid note ID" });
    return;
  }

  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.personaId, req.params.id)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/:id/notes", requireAuth, async (req: Request, res: Response) => {
  const [persona] = await db
    .select({ id: personas.id })
    .from(personas)
    .where(eq(personas.id, req.params.id));
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const parsed = AddPersonaNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [note] = await db
    .insert(notes)
    .values({
      personaId: req.params.id,
      type: parsed.data.type,
      sourceUrl: parsed.data.sourceUrl ?? null,
      sourceText: parsed.data.sourceText,
      response: parsed.data.response ?? null,
    })
    .returning();

  res.status(201).json(formatNote(note));
});

router.post("/:id/opinion", requireAuth, async (req: Request, res: Response) => {
  const [persona] = await db.select().from(personas).where(eq(personas.id, req.params.id));
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const parsed = GeneratePersonaOpinionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { sourceText, sourceUrl } = parsed.data;
  const personaData = normalizePersonaData(persona.data);

  const [contextRows, opinionRows] = await Promise.all([
    db
      .select()
      .from(notes)
      .where(and(eq(notes.personaId, req.params.id), eq(notes.type, "context")))
      .orderBy(notes.createdAt),
    db
      .select()
      .from(notes)
      .where(and(eq(notes.personaId, req.params.id), eq(notes.type, "opinion")))
      .orderBy(notes.createdAt),
  ]);
  const contextNotes: ContextNote[] = contextRows.map((n) => ({
    sourceText: n.sourceText,
    sourceUrl: n.sourceUrl,
    createdAt: n.createdAt.toISOString(),
  }));
  const opinionNotes: OpinionNote[] = opinionRows
    .filter((n) => n.response)
    .map((n) => ({
      sourceText: n.sourceText,
      sourceUrl: n.sourceUrl,
      response: n.response!,
      createdAt: n.createdAt.toISOString(),
    }));
  const systemPrompt = buildSystemPrompt(personaData, contextNotes, opinionNotes);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Прочитай этот фрагмент и дай краткую реакцию от своего лица (2-4 предложения): «${sourceText}»`,
      },
    ],
  });

  const opinion =
    message.content[0].type === "text"
      ? message.content[0].text
      : "Не удалось сгенерировать мнение.";

  const [note] = await db
    .insert(notes)
    .values({
      personaId: req.params.id,
      type: "opinion",
      sourceUrl: sourceUrl ?? null,
      sourceText,
      response: opinion,
    })
    .returning();

  res.json({ opinion, note: formatNote(note) });
});

router.post("/:id/interview", async (req: Request, res: Response) => {
  const [persona] = await db.select().from(personas).where(eq(personas.id, req.params.id));
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const parsed = InterviewPersonaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const personaData = normalizePersonaData(persona.data);

  const [contextRows, opinionRows] = await Promise.all([
    db
      .select()
      .from(notes)
      .where(and(eq(notes.personaId, req.params.id), eq(notes.type, "context")))
      .orderBy(notes.createdAt),
    db
      .select()
      .from(notes)
      .where(and(eq(notes.personaId, req.params.id), eq(notes.type, "opinion")))
      .orderBy(notes.createdAt),
  ]);
  const contextNotes: ContextNote[] = contextRows.map((n) => ({
    sourceText: n.sourceText,
    sourceUrl: n.sourceUrl,
    createdAt: n.createdAt.toISOString(),
  }));
  const opinionNotes: OpinionNote[] = opinionRows
    .filter((n) => n.response)
    .map((n) => ({
      sourceText: n.sourceText,
      sourceUrl: n.sourceUrl,
      response: n.response!,
      createdAt: n.createdAt.toISOString(),
    }));
  const systemPrompt = buildSystemPrompt(personaData, contextNotes, opinionNotes);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: parsed.data.messages,
    });

    let accumulatedContent = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        accumulatedContent += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    if (accumulatedContent && parsed.data.messages.length > 0) {
      const allMessages = [
        ...parsed.data.messages,
        { role: "assistant" as const, content: accumulatedContent },
      ];
      const sessionId = parsed.data.sessionId ?? null;
      if (sessionId) {
        await db
          .insert(interviews)
          .values({ personaId: req.params.id, sessionId, messages: allMessages })
          .onConflictDoUpdate({
            target: interviews.sessionId,
            set: { messages: allMessages },
          });
      } else {
        await db.insert(interviews).values({
          personaId: req.params.id,
          messages: allMessages,
        });
      }
    }
  } catch (err) {
    req.log.error({ err }, "Error streaming from Anthropic");
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  }
});

router.get("/:id/interviews", async (req: Request, res: Response) => {
  const [persona] = await db
    .select({ id: personas.id })
    .from(personas)
    .where(eq(personas.id, req.params.id));
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const rows = await db
    .select({
      id: interviews.id,
      personaId: interviews.personaId,
      summary: interviews.summary,
      messageCount: sql<number>`jsonb_array_length(${interviews.messages})`,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .where(eq(interviews.personaId, req.params.id))
    .orderBy(interviews.createdAt);

  res.json(rows.map((r) => ({ ...r, messageCount: Number(r.messageCount) })));
});

router.get("/:id/interviews/:iid", async (req: Request, res: Response) => {
  const iid = parseInt(req.params.iid, 10);
  if (isNaN(iid)) {
    res.status(400).json({ error: "Invalid interview ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, iid), eq(interviews.personaId, req.params.id)));

  if (!row) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.json({
    id: row.id,
    personaId: row.personaId,
    messages: row.messages,
    summary: row.summary,
    createdAt: row.createdAt,
  });
});

router.delete("/:id/interviews/:iid", requireAuth, async (req: Request, res: Response) => {
  const iid = parseInt(req.params.iid, 10);
  if (isNaN(iid)) {
    res.status(400).json({ error: "Invalid interview ID" });
    return;
  }

  const deleted = await db
    .delete(interviews)
    .where(and(eq(interviews.id, iid), eq(interviews.personaId, req.params.id)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/:id/interviews/:iid/summary", async (req: Request, res: Response) => {
  const iid = parseInt(req.params.iid, 10);
  if (isNaN(iid)) {
    res.status(400).json({ error: "Invalid interview ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, iid), eq(interviews.personaId, req.params.id)));

  if (!row) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const [personaRow] = await db
    .select()
    .from(personas)
    .where(eq(personas.id, req.params.id));

  const personaName = personaRow?.name ?? "персона";

  const messages = row.messages as { role: string; content: string }[];

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Исследователь" : personaName}: ${m.content}`)
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Ты — бизнес-аналитик. Сделай краткое резюме этого интервью между исследователем и ${personaName}: ключевые темы, реакция персоны, возражения, следующие шаги.\n\nТранскрипт:\n${transcript}`,
      },
    ],
  });

  const summary =
    message.content[0].type === "text"
      ? message.content[0].text
      : "Не удалось сгенерировать саммари.";

  await db
    .update(interviews)
    .set({ summary })
    .where(eq(interviews.id, iid));

  res.json({ summary });
});

export async function seedPersonas(): Promise<void> {
  for (const p of PERSONAS) {
    const now = new Date();
    await db
      .insert(personas)
      .values({
        id: p.id,
        name: p.name,
        role: p.role,
        company: p.company,
        data: p as unknown as Record<string, unknown>,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: personas.id,
        set: {
          name: p.name,
          role: p.role,
          company: p.company,
          data: p as unknown as Record<string, unknown>,
          updatedAt: now,
        },
      });
  }
}

export default router;

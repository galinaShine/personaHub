# Промпт для Replit Agent — PersonaHub расширение

Скопируй и вставь в чат Replit Agent:

---

## Задача

Расширить приложение PersonaHub: добавить библиотеку синтетических персон с заметками, мнениями и интервью. Сейчас в проекте есть только `conversations` и `messages` для generic чата. Нужно добавить полноценный CRUD для персон и систему заметок.

## 1. Новые таблицы в БД (Drizzle schema)

Добавь два новых файла в `lib/db/src/schema/`:

### `lib/db/src/schema/personas.ts`

```typescript
import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personas = pgTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  company: text("company").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  createdAt: true,
  updatedAt: true,
});

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
```

### `lib/db/src/schema/notes.ts`

```typescript
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { personas } from "./personas";

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'opinion' | 'clip' | 'interview_log'
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
```

### Обнови `lib/db/src/schema/index.ts`

```typescript
export * from "./conversations";
export * from "./messages";
export * from "./personas";
export * from "./notes";
```

Запусти `pnpm drizzle-kit generate` и `pnpm drizzle-kit migrate` чтобы создать таблицы.

## 2. Новые API-эндпоинты

Добавь в OpenAPI spec (`lib/api-spec/openapi.yaml`) новый tag `personas` и следующие пути:

### Personas CRUD:
- `GET /personas` — список всех персон (id, name, role, company, createdAt)
- `GET /personas/{id}` — полное досье + заметки
- `POST /personas` — создать/обновить персону (upsert по id). Header: `Authorization: Bearer {PH_SECRET}`
- `DELETE /personas/{id}` — удалить

### Notes:
- `POST /personas/{id}/notes` — добавить заметку (clip или opinion request)
- `GET /personas/{id}/notes` — список заметок

### Opinion (с AI):
- `POST /personas/{id}/opinion` — принимает `{ sourceText, sourceUrl }`, генерирует мнение от лица персоны через Anthropic API, сохраняет как note, возвращает ответ

### Interview:
- `POST /personas/{id}/interview` — принимает `{ messages: [{role, content}] }`, подставляет system prompt на основе досье персоны, проксирует через Anthropic API, возвращает ответ (можно SSE stream как в текущем чате)

## 3. Логика Opinion и Interview

Для эндпоинтов `/opinion` и `/interview` нужен system prompt, который строится из досье персоны. Вот шаблон:

```typescript
function buildSystemPrompt(persona: any): string {
  const p = persona.data || persona;
  return `Ты — ${p.name}, ${p.role} в ${p.company}.

ДОСЬЕ:
Карьера: ${p.career || ''}
Ситуация: ${p.situation || ''}
Цели: ${(p.goals?.professional || []).join('; ')}
Боли: ${(p.pains || []).map((x: any) => x.pain + ' — ' + x.detail).join('\n')}
Критерии: ${(p.decisions?.criteria || []).join(', ')}
Стиль: ${p.psycho?.style || ''}
Триггеры: ${(p.psycho?.triggers || []).join('; ')}
Red flags: ${(p.psycho?.redFlags || []).join('; ')}
Типичные фразы: ${(p.phrases || []).join(' | ')}

ПРАВИЛА:
- Отвечай ТОЛЬКО от первого лица как ${p.name}. Не выходи из роли.
- Будь реалистично скептичен. Не соглашайся легко.
- Если вне компетенции — скажи прямо.
- Отвечай на русском.`;
}
```

Для `/opinion` — user message = `"Прочитай эту цитату и дай своё мнение как ${persona.name}:\n\n\"${sourceText}\"\n\nИсточник: ${sourceUrl || 'не указан'}"`.

Сохрани response как note с type='opinion'.

## 4. Авторизация

Добавь простую авторизацию для мутирующих эндпоинтов (POST/DELETE):
- Env variable `PH_SECRET` (Replit Secrets)  
- Проверяй header `Authorization: Bearer {PH_SECRET}`
- GET-запросы без авторизации (чтобы Chrome extension мог читать список персон)

## 5. Обновить фронтенд

Текущий фронтенд показывает generic чат. Нужно добавить:

### Главная страница — библиотека персон:
- Список карточек персон (GET /personas)
- Клик → открывает досье с вкладками: Профиль, Боли, Решения, Фразы, Психографика, Заметки
- Кнопка «Начать интервью» → открывает чат, работающий через POST /personas/{id}/interview
- Вкладка «Заметки» показывает notes: тип opinion (цитата + ответ), тип clip (только цитата + URL)

### Дизайн:
- Двухпанельный layout: слева список персон, справа досье или чат
- Шрифт: Onest (Google Fonts)
- Цвета: bg #F8F7F4, accent #D4380D, cards white with subtle shadows
- Минималистичный, не перегруженный

## 6. CORS

Добавь CORS middleware для Chrome extension:
```typescript
app.use(cors({ origin: true, credentials: true }));
```

## Порядок выполнения

1. Создай таблицы personas и notes
2. Добавь API-эндпоинты
3. Обнови OpenAPI spec и перегенерируй клиент
4. Обнови фронтенд
5. Протестируй: создай персону через API, открой досье, запусти интервью

## Важно

- Не трогай существующие conversations/messages — они могут остаться для legacy
- Используй существующий Anthropic client из `lib/integrations-anthropic-ai/src/client.ts`
- Все новые файлы — TypeScript
- Данные персон хранятся как JSONB в поле `data` — это позволяет гибко расширять формат досье

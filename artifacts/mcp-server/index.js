import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = (process.env.PH_API_BASE || "").replace(/\/+$/, "");
const API_SECRET = process.env.PH_SECRET || "";

if (!API_BASE) {
  process.stderr.write("ERROR: PH_API_BASE environment variable is required\n");
  process.exit(1);
}
if (!API_SECRET) {
  process.stderr.write("ERROR: PH_SECRET environment variable is required\n");
  process.exit(1);
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Normalize the persona data from the MCP tool schema (user-facing)
 * to the backend storage format.
 *
 * MCP schema uses:          Backend stores:
 *   psychoprofile.*    →      psycho.*
 *   voice.phrases      →      phrases
 */
function normalizePersonaData(id, name, role, company, data) {
  const { psychoprofile, voice, ...rest } = data;

  const normalized = {
    id,
    name,
    role,
    company,
    ...rest,
    psycho: psychoprofile ?? data.psycho ?? {},
    phrases: voice?.phrases ?? data.phrases ?? [],
  };

  return normalized;
}

const server = new Server(
  { name: "personahub", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_personas",
      description:
        "Показать список всех персон в библиотеке PersonaHub. Возвращает id, имя, роль и компанию каждой персоны.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "create_persona",
      description: `Создать новую или обновить существующую персону в PersonaHub. Требуется Bearer-авторизация (PH_SECRET).

Структура поля data — все поля обязательны:
- age: string — возраст (например "38")
- location: string — город (например "Москва")
- education: string — образование
- experience: string — общий опыт работы
- career: string — история карьеры (несколько предложений)
- situation: string — текущая рабочая ситуация: масштаб, проблемы, контекст
- goals.professional: string[] — профессиональные цели (3–5 пунктов)
- goals.personal: string[] — личные амбиции (2–3 пункта)
- pains: { pain: string, severity: "low"|"medium"|"high"|"critical", detail: string }[] — боли (3–5 штук)
- decisions.criteria: string[] — критерии выбора решений
- decisions.influence: string[] — стейкхолдеры, влияющие на решение
- decisions.procCycle: string — цикл принятия решений и закупки
- decisions.budget: string — бюджетные полномочия
- psychoprofile.style: string — стиль коммуникации и принятия решений
- psychoprofile.risk: string — отношение к риску
- psychoprofile.triggers: string[] — что цепляет, что вызывает интерес
- psychoprofile.redFlags: string[] — что отталкивает, стоп-сигналы
- voice.phrases: string[] — 4–6 характерных фраз от первого лица

Поле id: используй slug в формате "имя-отрасль", например "anna-retail-cx".`,
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Уникальный slug-идентификатор персоны, например 'anna-retail-cx'",
          },
          name: {
            type: "string",
            description: "Полное имя персоны",
          },
          role: {
            type: "string",
            description: "Должность персоны",
          },
          company: {
            type: "string",
            description: "Название компании персоны",
          },
          data: {
            type: "object",
            description: "Полный профиль персоны — см. описание инструмента",
            properties: {
              age: { type: "string" },
              location: { type: "string" },
              education: { type: "string" },
              experience: { type: "string" },
              career: { type: "string" },
              situation: { type: "string" },
              goals: {
                type: "object",
                properties: {
                  professional: { type: "array", items: { type: "string" } },
                  personal: { type: "array", items: { type: "string" } },
                },
                required: ["professional", "personal"],
              },
              pains: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pain: { type: "string" },
                    severity: {
                      type: "string",
                      enum: ["low", "medium", "high", "critical"],
                    },
                    detail: { type: "string" },
                  },
                  required: ["pain", "severity", "detail"],
                },
              },
              decisions: {
                type: "object",
                properties: {
                  criteria: { type: "array", items: { type: "string" } },
                  influence: { type: "array", items: { type: "string" } },
                  procCycle: { type: "string" },
                  budget: { type: "string" },
                },
                required: ["criteria", "influence", "procCycle", "budget"],
              },
              psychoprofile: {
                type: "object",
                description: "Психологический профиль персоны",
                properties: {
                  style: { type: "string" },
                  risk: { type: "string" },
                  triggers: { type: "array", items: { type: "string" } },
                  redFlags: { type: "array", items: { type: "string" } },
                },
                required: ["style", "risk", "triggers", "redFlags"],
              },
              voice: {
                type: "object",
                description: "Голос персоны — характерные фразы",
                properties: {
                  phrases: {
                    type: "array",
                    items: { type: "string" },
                    description: "4–6 характерных фраз от первого лица",
                  },
                },
                required: ["phrases"],
              },
            },
            required: [
              "age",
              "location",
              "education",
              "experience",
              "career",
              "situation",
              "goals",
              "pains",
              "decisions",
              "psychoprofile",
              "voice",
            ],
          },
        },
        required: ["id", "name", "role", "company", "data"],
      },
    },
    {
      name: "add_context",
      description:
        "Добавить текст в контекст персоны как её собственные слова или знания. Используй, когда нужно добавить персоне информацию о конкретном продукте, ситуации, или её позицию по какому-либо вопросу. Текст будет использоваться при интервью с персоной.",
      inputSchema: {
        type: "object",
        properties: {
          persona_id: {
            type: "string",
            description:
              "ID персоны (slug), например 'marina-bank-cc'. Используй list_personas чтобы получить список.",
          },
          text: {
            type: "string",
            description: "Текст для добавления в контекст персоны",
          },
          source_url: {
            type: "string",
            description: "URL источника (необязательно)",
          },
        },
        required: ["persona_id", "text"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_personas") {
      const personas = await apiGet("/api/personas");
      const list = personas
        .map((p) => `• ${p.name} (${p.role}, ${p.company}) — id: ${p.id}`)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Персоны в PersonaHub (${personas.length}):\n\n${list}`,
          },
        ],
      };
    }

    if (name === "create_persona") {
      const { id, name: personaName, role, company, data } = args;

      // Normalize from MCP schema (psychoprofile/voice.phrases) to backend format (psycho/phrases)
      const backendData = normalizePersonaData(id, personaName, role, company, data);

      const result = await apiPost("/api/personas", {
        id,
        name: personaName,
        role,
        company,
        data: backendData,
      });

      return {
        content: [
          {
            type: "text",
            text: `✓ Персона создана/обновлена:\n• Имя: ${result.name}\n• Роль: ${result.role}\n• Компания: ${result.company}\n• ID: ${result.id}`,
          },
        ],
      };
    }

    if (name === "add_context") {
      const { persona_id, text, source_url } = args;
      await apiPost(`/api/personas/${persona_id}/notes`, {
        type: "context",
        sourceText: text,
        sourceUrl: source_url || null,
      });
      return {
        content: [
          {
            type: "text",
            text: `✓ Контекст добавлен к персоне ${persona_id}.`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `Неизвестный инструмент: ${name}` }],
      isError: true,
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Ошибка: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

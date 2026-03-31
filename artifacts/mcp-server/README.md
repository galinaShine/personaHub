# PersonaHub MCP Server

Подключает PersonaHub к Claude Desktop — позволяет создавать и управлять персонами прямо из чата.

## Инструменты

| Инструмент | Что делает |
|---|---|
| `list_personas` | Показывает все персоны в библиотеке |
| `create_persona` | Создаёт или обновляет персону |
| `add_context` | Добавляет текст в контекст персоны |

## Установка

### 1. Установить зависимости

```bash
cd artifacts/mcp-server
npm install
```

### 2. Узнать абсолютный путь к файлу

```bash
# macOS / Linux
pwd
# Пример результата: /Users/anna/projects/workspace/artifacts/mcp-server
```

### 3. Добавить в настройки Claude Desktop

Открыть файл конфигурации:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Добавить блок `mcpServers`:

```json
{
  "mcpServers": {
    "personahub": {
      "command": "node",
      "args": ["/АБСОЛЮТНЫЙ/ПУТЬ/artifacts/mcp-server/index.js"],
      "env": {
        "PH_API_BASE": "https://ВАШ_ДОМЕН.replit.app",
        "PH_SECRET": "ваш_секретный_ключ"
      }
    }
  }
}
```

> `PH_API_BASE` — URL задеплоенного приложения (без слеша в конце)  
> `PH_SECRET` — тот же ключ, что используется для удаления записей в приложении

### 4. Перезапустить Claude Desktop

После сохранения конфига полностью закройте и откройте Claude Desktop заново.

### 5. Проверить подключение

В чате с Клодом нажмите на иконку инструментов (🔨) — должен появиться `personahub`.  
Попробуйте: «Покажи список персон в PersonaHub».

---

## Примеры использования

### Создать персону

```
Создай новую персону для PersonaHub:

Имя: Ольга Ветрова
Роль: Директор по маркетингу
Компания: ООО «ТехноТорг»
Отрасль: B2B e-commerce

Ольга, 41 год, Санкт-Петербург. 15 лет в маркетинге, последние 3 года занимается digital-трансформацией
маркетинга в компании с оборотом 2 млрд рублей. Её главная боль — нет сквозной аналитики,
невозможно отследить путь клиента от клика до сделки. Хочет внедрить CDP-платформу,
но бюджет ограничен и нужно согласование с финдиром.
```

### Добавить контекст к существующей персоне

```
Добавь в контекст персоны marina-bank-cc:
«В марте 2026 мы запустили пилот с новым поставщиком речевой аналитики.
Первые результаты — AHT снизился на 8%, но качество транскрипций нестабильное.»
```

### Обновить персону

Просто вызови `create_persona` с тем же `id` — данные перезапишутся.

---

## Структура данных персоны (поле `data`)

Claude заполняет эти поля автоматически на основе вашего описания:

```
age, location, education, experience
career               — история карьеры
situation            — текущая рабочая ситуация
goals                — { professional: [...], personal: [...] }
pains                — [{ pain, severity: critical|high|medium|low, detail }]
decisions            — { criteria, influence, procCycle, budget }
psychoprofile        — { style, risk, triggers, redFlags }
voice.phrases        — характерные фразы персоны (4–6 штук)
```

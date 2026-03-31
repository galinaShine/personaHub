import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Building2, User, AlertCircle, CheckCircle2, Loader2,
  ArrowLeft, Upload, ClipboardPaste, FileJson,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PersonaImportData {
  id: string;
  name: string;
  role: string;
  company: string;
  tags?: string[];
  data: {
    age?: string;
    location?: string;
    tags?: string[];
    pains?: { pain: string; severity: string; detail: string }[];
    phrases?: string[];
    [key: string]: unknown;
  };
}

type ParseResult =
  | { ok: true; persona: PersonaImportData; passphrase?: string }
  | { ok: false; error: string };

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function extractPassphrase(text: string): string | undefined {
  const m = text.match(/Authorization:\s*Bearer\s+([^\s\\'"\n]+)/i);
  return m?.[1];
}

function parsePersonaFromText(text: string): ParseResult {
  // Try direct parse first (handles clean .json files)
  let obj: unknown;
  try {
    obj = JSON.parse(text.trim());
  } catch {
    // Fallback: extract first balanced JSON object (handles .sh heredoc and mixed text)
    const jsonStr = extractJsonObject(text);
    if (!jsonStr) {
      return { ok: false, error: "Не удалось найти JSON персоны в файле. Убедитесь, что файл содержит данные персоны." };
    }
    try {
      obj = JSON.parse(jsonStr);
    } catch {
      return { ok: false, error: "JSON в файле повреждён — не удалось разобрать. Попросите Claude сформировать файл заново." };
    }
  }
  const p = obj as Record<string, unknown>;
  if (!p.id || !p.name || !p.role || !p.company) {
    return { ok: false, error: "В данных персоны отсутствуют обязательные поля: id, name, role, company." };
  }
  return { ok: true, persona: p as unknown as PersonaImportData, passphrase: extractPassphrase(text) };
}

type Mode = "upload" | "paste";
type Stage = "input" | "preview";

export default function ImportPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("upload");
  const [stage, setStage] = useState<Stage>("input");
  const [pasteText, setPasteText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaImportData | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleText = useCallback((text: string) => {
    setParseError(null);
    const result = parsePersonaFromText(text);
    if (!result.ok) { setParseError(result.error); return; }
    setPersona(result.persona);
    if (result.passphrase) setPassphrase(result.passphrase);
    setStage("preview");
  }, []);

  const handleFile = useCallback((file: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => handleText(e.target?.result as string ?? "");
    reader.readAsText(file, "utf-8");
  }, [handleText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!persona || !passphrase.trim()) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/api/personas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${passphrase.trim()}`,
        },
        body: JSON.stringify({
          id: persona.id,
          name: persona.name,
          role: persona.role,
          company: persona.company,
          data: {
            ...persona.data,
            tags: persona.data?.tags ?? persona.tags ?? [],
          },
        }),
      });
      if (res.status === 401) { setSubmitError("Неверная парольная фраза. Проверьте ключ и попробуйте снова."); setLoading(false); return; }
      if (!res.ok) { const b = await res.json().catch(() => ({})); setSubmitError(b.error ?? `Ошибка сервера: ${res.status}`); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => navigate(`/?persona=${persona.id}`), 1200);
    } catch {
      setSubmitError("Не удалось подключиться к серверу. Проверьте соединение.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center pt-12 px-4 font-sans">
      <div className="w-full max-w-lg">
        <button
          onClick={() => stage === "preview" ? (setStage("input"), setParseError(null)) : navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {stage === "preview" ? "Назад" : "В PersonaHub"}
        </button>

        {stage === "input" ? (
          <InputStage
            mode={mode}
            setMode={setMode}
            pasteText={pasteText}
            setPasteText={setPasteText}
            parseError={parseError}
            dragOver={dragOver}
            setDragOver={setDragOver}
            fileRef={fileRef}
            onFile={handleFile}
            onText={handleText}
            onDrop={handleDrop}
          />
        ) : (
          <PreviewStage
            persona={persona!}
            passphrase={passphrase}
            setPassphrase={setPassphrase}
            loading={loading}
            error={submitError}
            success={success}
            onImport={handleImport}
          />
        )}
      </div>
    </div>
  );
}

interface InputStageProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  pasteText: string;
  setPasteText: (t: string) => void;
  parseError: string | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onText: (t: string) => void;
  onDrop: (e: React.DragEvent) => void;
}

function InputStage({
  mode, setMode, pasteText, setPasteText, parseError,
  dragOver, setDragOver, fileRef, onFile, onText, onDrop,
}: InputStageProps) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Импорт персоны</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Попросите Claude: «Сохрани персону как файл <code className="font-mono bg-secondary px-1 rounded">push-&#60;id&#62;.sh</code> или <code className="font-mono bg-secondary px-1 rounded">persona-&#60;id&#62;.json</code>» — и загрузите файл ниже.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex p-1 bg-secondary rounded-xl border border-border/50 mb-5">
        <button
          onClick={() => setMode("upload")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
            mode === "upload" ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="w-4 h-4" />
          Загрузить файл
        </button>
        <button
          onClick={() => setMode("paste")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
            mode === "paste" ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ClipboardPaste className="w-4 h-4" />
          Вставить текст
        </button>
      </div>

      {mode === "upload" ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "relative flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200",
            dragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border bg-card hover:border-primary/50 hover:bg-secondary/30"
          )}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileJson className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-foreground text-base mb-1">
              {dragOver ? "Отпустите файл" : "Нажмите или перетащите файл"}
            </p>
            <p className="text-sm text-muted-foreground">Поддерживаются файлы <code className="font-mono bg-secondary px-1 rounded">.sh</code> и <code className="font-mono bg-secondary px-1 rounded">.json</code></p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".sh,.json,text/x-sh,application/json,text/plain"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Вставьте содержимое .sh файла или чистый JSON персоны…\n\n{\n  \"id\": \"...\",\n  \"name\": \"...\",\n  ...\n}"}
            className="w-full h-52 px-4 py-3 border border-border rounded-xl text-sm bg-card outline-none focus:border-primary transition-colors font-mono resize-none placeholder:text-muted-foreground/50"
          />
          <button
            onClick={() => onText(pasteText)}
            disabled={!pasteText.trim()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Разобрать
          </button>
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-2 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {parseError}
        </div>
      )}
    </>
  );
}

interface PreviewStageProps {
  persona: PersonaImportData;
  passphrase: string;
  setPassphrase: (v: string) => void;
  loading: boolean;
  error: string | null;
  success: boolean;
  onImport: () => void;
}

function PreviewStage({ persona, passphrase, setPassphrase, loading, error, success, onImport }: PreviewStageProps) {
  const tags = persona.data?.tags ?? persona.tags ?? [];
  const age = persona.data?.age;
  const location = persona.data?.location;
  const pains = persona.data?.pains ?? [];
  const phrases = persona.data?.phrases ?? [];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Импорт персоны</h1>
        <p className="text-muted-foreground mt-1 text-sm">Проверьте данные и добавьте персону в хаб.</p>
      </div>

      {/* Preview card */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 shadow-sm">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-lg shrink-0">
            {persona.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-display font-bold text-foreground text-lg leading-tight">{persona.name}</div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />{persona.role}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />{persona.company}
            </div>
          </div>
        </div>

        {(age || location) && (
          <div className="text-sm text-muted-foreground mb-3">
            {[age ? `${age} лет` : null, location].filter(Boolean).join(" · ")}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((t, i) => (
              <span key={i} className="px-2.5 py-0.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-semibold">{t}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{pains.length}</div>
            <div className="text-xs text-muted-foreground">болей</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{phrases.length}</div>
            <div className="text-xs text-muted-foreground">фраз</div>
          </div>
        </div>
      </div>

      {/* Auth + submit */}
      {success ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <span className="text-sm font-semibold">Персона добавлена! Перенаправляем…</span>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Ключ доступа к хабу
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onImport()}
            placeholder="Введите ключ доступа к хабу"
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background outline-none focus:border-primary transition-colors font-mono"
            autoFocus={!passphrase}
          />
          {passphrase && (
            <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ключ извлечён из файла автоматически
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={onImport}
            disabled={loading || !passphrase.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Добавляю…</>) : "Добавить в PersonaHub"}
          </button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-6">
        ID персоны: <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">{persona.id}</code>
      </p>
    </>
  );
}

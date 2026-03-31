import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Persona } from "@/data/personas";
import { 
  Briefcase, Target, GraduationCap, AlertCircle, BookOpen,
  CheckCircle2, XCircle, Quote, TrendingUp, UserRound,
  StickyNote, ExternalLink, MessageSquare, Loader2, Brain, Trash2, Lock, Unlock, KeyRound,
  Clock, Download, Sparkles, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DossierProps {
  persona: Persona;
  onDelete?: () => void;
}

type TabType = "overview" | "phrases" | "notes" | "context" | "archive";

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: "overview", label: "Обзор", icon: BookOpen },
  { id: "phrases", label: "Фразы", icon: Quote },
  { id: "notes", label: "Мнения", icon: StickyNote },
  { id: "context", label: "Контекст", icon: Brain },
  { id: "archive", label: "Интервью", icon: MessageSquare },
];

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PersonaNote {
  id: number;
  personaId: string;
  type: string;
  sourceUrl: string | null;
  sourceText: string;
  response: string | null;
  createdAt: string;
}

interface InterviewSummaryItem {
  id: number;
  personaId: string;
  summary: string | null;
  messageCount: number;
  createdAt: string;
}

interface InterviewMessage {
  role: string;
  content: string;
}

function usePersonaNotes(personaId: string, enabled: boolean) {
  return useQuery<PersonaNote[]>({
    queryKey: ["persona-notes", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/notes`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
    refetchInterval: false,
  });
}

function NoteCard({
  note,
  personaFirstName,
  onDelete,
  deleting,
}: {
  note: PersonaNote;
  personaFirstName: string;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: deleting ? 0 : 1, y: 0, scale: deleting ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.97, y: -5 }}
      transition={{ duration: 0.2 }}
      className="p-6 rounded-2xl bg-card border border-border shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          {note.type === "opinion" ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold uppercase tracking-wider">
              <MessageSquare className="w-3 h-3" />
              Мнение
            </span>
          ) : note.type === "clip" ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/50 text-accent-foreground rounded-lg text-xs font-bold uppercase tracking-wider">
              <Quote className="w-3 h-3" />
              Клип
            </span>
          ) : note.type === "context" ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider">
              <Brain className="w-3 h-3" />
              Контекст
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold uppercase tracking-wider">
              {note.type}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {note.sourceUrl && (
            <a
              href={note.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Открыть источник"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(note.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <button
            onClick={() => onDelete(note.id)}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 ml-1"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <blockquote className="text-sm text-muted-foreground italic border-l-2 border-border pl-4 mb-4 leading-relaxed">
        «{note.sourceText}»
      </blockquote>

      {note.response && (
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
          <div className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
            Реакция {personaFirstName}
          </div>
          <p className="text-foreground/90 leading-relaxed text-sm">{note.response}</p>
        </div>
      )}
    </motion.div>
  );
}

export function Dossier({ persona, onDelete }: DossierProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [apiKey, setApiKey] = useState<string>("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState(false);
  const [deletingPersona, setDeletingPersona] = useState(false);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [summaryLoading, setSummaryLoading] = useState<Set<number>>(new Set());
  const [deletingInterviewIds, setDeletingInterviewIds] = useState<Set<number>>(new Set());

  const notesEnabled = activeTab === "notes" || activeTab === "context";
  const { data: allNotes, isLoading: notesLoading } = usePersonaNotes(persona.id, notesEnabled);

  const archiveEnabled = activeTab === "archive";
  const { data: interviewList, isLoading: interviewsLoading } = useQuery<InterviewSummaryItem[]>({
    queryKey: ["interviews", persona.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}/interviews`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: archiveEnabled,
    refetchInterval: false,
  });

  const regularNotes = (allNotes ?? []).filter((n) => n.type !== "context");
  const contextNotes = (allNotes ?? []).filter((n) => n.type === "context");

  const handleUnlock = () => {
    const candidate = keyInput.trim();
    if (!candidate) return;
    setApiKey(candidate);
    setKeyError(false);
    setKeyInput("");
    setShowKeyInput(false);
  };

  const handleDeletePersona = async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      setTimeout(() => keyInputRef.current?.focus(), 50);
      return;
    }
    if (!confirm(`Удалить персону «${persona.name}»? Это действие необратимо.`)) return;

    setDeletingPersona(true);
    try {
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401) {
        setApiKey("");
        setShowKeyInput(true);
        setKeyError(true);
        return;
      }
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["personas"] });
        onDelete?.();
      }
    } catch {
      // silent — persona stays selected on network error
    } finally {
      setDeletingPersona(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!apiKey) {
      setShowKeyInput(true);
      setTimeout(() => keyInputRef.current?.focus(), 50);
      return;
    }

    const queryKey = ["persona-notes", persona.id];
    const previous = queryClient.getQueryData<PersonaNote[]>(queryKey);

    queryClient.setQueryData<PersonaNote[]>(queryKey, (old) =>
      (old ?? []).filter((n) => n.id !== noteId),
    );
    setDeletingIds((prev) => new Set(prev).add(noteId));

    try {
      const res = await fetch(
        `${API_BASE}/api/personas/${persona.id}/notes/${noteId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (res.status === 401) {
        setApiKey("");
        queryClient.setQueryData(queryKey, previous);
        setShowKeyInput(true);
        setKeyError(true);
      } else if (!res.ok) {
        queryClient.setQueryData(queryKey, previous);
      }
    } catch {
      queryClient.setQueryData(queryKey, previous);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const handleGenerateSummary = async (iid: number) => {
    setSummaryLoading((prev) => new Set(prev).add(iid));
    try {
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}/interviews/${iid}/summary`, {
        method: "POST",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["interviews", persona.id] });
      }
    } finally {
      setSummaryLoading((prev) => {
        const next = new Set(prev);
        next.delete(iid);
        return next;
      });
    }
  };

  const handleDeleteInterview = async (iid: number) => {
    if (!apiKey) {
      setShowKeyInput(true);
      setTimeout(() => keyInputRef.current?.focus(), 50);
      return;
    }
    if (!confirm("Удалить это интервью?")) return;

    const queryKey = ["interviews", persona.id];
    const previous = queryClient.getQueryData<InterviewSummaryItem[]>(queryKey);
    queryClient.setQueryData<InterviewSummaryItem[]>(queryKey, (old) =>
      (old ?? []).filter((iv) => iv.id !== iid),
    );
    setDeletingInterviewIds((prev) => new Set(prev).add(iid));

    try {
      const res = await fetch(
        `${API_BASE}/api/personas/${persona.id}/interviews/${iid}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (res.status === 401) {
        setApiKey("");
        queryClient.setQueryData(queryKey, previous);
        setShowKeyInput(true);
        setKeyError(true);
      } else if (!res.ok) {
        queryClient.setQueryData(queryKey, previous);
      }
    } catch {
      queryClient.setQueryData(queryKey, previous);
    } finally {
      setDeletingInterviewIds((prev) => {
        const next = new Set(prev);
        next.delete(iid);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["interviews", persona.id] });
    }
  };

  const handleDownloadInterview = async (iv: InterviewSummaryItem) => {
    const res = await fetch(`${API_BASE}/api/personas/${persona.id}/interviews/${iv.id}`);
    if (!res.ok) return;
    const data: { messages: InterviewMessage[]; summary: string | null } = await res.json();

    const date = new Date(iv.createdAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const lines: string[] = [
      `Интервью с ${persona.name} — ${date}`,
      "=====================================",
      "",
    ];
    for (const m of data.messages) {
      const speaker = m.role === "user" ? "Исследователь" : persona.name;
      lines.push(`${speaker}: ${m.content}`);
      lines.push("");
    }
    if (data.summary) {
      lines.push("САММАРИ:");
      lines.push(data.summary);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-${persona.id}-${iv.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const personaFirstName = persona.name.split(" ")[0];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header card */}
      <div className="max-w-4xl mx-auto px-6 lg:px-10 pt-6 lg:pt-10 pb-6">
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm">
          <div className="w-24 h-24 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-3xl shadow-inner border border-primary/20 shrink-0">
            {persona.name.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase()}
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-start gap-3">
              <h2 className="text-3xl font-display font-bold text-foreground flex-1">{persona.name}</h2>
              <button
                onClick={handleDeletePersona}
                disabled={deletingPersona}
                title="Удалить персону"
                className="mt-1 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-40 shrink-0"
              >
                {deletingPersona ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <Briefcase className="w-4 h-4 shrink-0" />
              {persona.role}, {persona.company}
            </div>
            {(persona.age || persona.location || persona.experience) && (
              <div className="flex flex-wrap gap-2">
                {persona.age && (
                  <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {persona.age} лет
                  </span>
                )}
                {persona.location && (
                  <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {persona.location}
                  </span>
                )}
                {persona.experience && (
                  <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {persona.experience}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {persona.tags.map(t => (
                <span key={t} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-lg text-xs font-semibold">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Tab Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-6 lg:px-10">
          <div className="flex overflow-x-auto py-3 scrollbar-hide gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 rounded-xl font-display font-semibold text-sm whitespace-nowrap transition-all duration-300 relative",
                    isActive
                      ? "text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="dossier-tab"
                      className="absolute inset-0 bg-primary rounded-xl z-0"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("w-4 h-4 relative z-10", isActive ? "text-primary-foreground/80" : "")} />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-6 lg:px-10 pt-6 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + persona.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* ── ОБЗОР (profile + pains + decisions + psycho) ── */}
            {activeTab === "overview" && (
              <div className="space-y-10">
                {/* Профиль */}
                <SectionGroup title="Профиль" pillClass="bg-primary/10 text-primary" borderColor="border-primary/40">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Section title="Карьерный путь">
                      <p className="text-foreground/80 leading-relaxed text-sm">{persona.career}</p>
                    </Section>
                    <Section title="Текущая ситуация">
                      <p className="text-foreground/80 leading-relaxed text-sm">{persona.situation}</p>
                    </Section>
                    <Section title="Профессиональные цели">
                      <ul className="space-y-2">
                        {persona.goals.professional.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="Личные мотивы">
                      <ul className="space-y-2">
                        {persona.goals.personal.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="Образование и опыт" className="lg:col-span-2">
                      <div className="flex flex-wrap gap-4">
                        <InfoBlock icon={GraduationCap} label="Образование" value={persona.education} />
                        <InfoBlock icon={Briefcase} label="Опыт" value={persona.experience} />
                      </div>
                    </Section>
                  </div>
                </SectionGroup>

                {/* Боли */}
                <SectionGroup title="Боли и вызовы" pillClass="bg-destructive/10 text-destructive" borderColor="border-destructive/40">
                  <div className="space-y-4">
                    {persona.pains.map((p, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-6 rounded-2xl border",
                          p.severity === "critical"
                            ? "bg-destructive/5 border-destructive/30"
                            : p.severity === "high"
                            ? "bg-orange-500/5 border-orange-500/20"
                            : "bg-secondary/30 border-border",
                        )}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <AlertCircle
                            className={cn(
                              "w-5 h-5 shrink-0",
                              p.severity === "critical"
                                ? "text-destructive"
                                : p.severity === "high"
                                ? "text-orange-500"
                                : "text-muted-foreground",
                            )}
                          />
                          <h4 className="font-display font-bold text-base">{p.pain}</h4>
                          <span
                            className={cn(
                              "ml-auto px-2 py-0.5 rounded-md text-xs font-bold uppercase",
                              p.severity === "critical"
                                ? "bg-destructive/20 text-destructive"
                                : p.severity === "high"
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-secondary text-muted-foreground",
                            )}
                          >
                            {p.severity}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/75 leading-relaxed pl-8">{p.detail}</p>
                      </div>
                    ))}
                  </div>
                </SectionGroup>

                {/* Принятие решений */}
                <SectionGroup title="Принятие решений" pillClass="bg-amber-500/10 text-amber-700 dark:text-amber-400" borderColor="border-amber-500/40">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Section title="Критерии выбора">
                      <ul className="space-y-2">
                        {persona.decisions.criteria.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="Стейкхолдеры">
                      <ul className="space-y-2">
                        {persona.decisions.influence.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <UserRound className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="Цикл закупки" className="lg:col-span-2">
                      <p className="text-sm text-foreground/80 leading-relaxed mb-4">{persona.decisions.procCycle}</p>
                      <div className="bg-secondary/40 rounded-xl p-4 border border-border">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Бюджет</span>
                        <p className="text-sm font-medium text-foreground mt-1">{persona.decisions.budget}</p>
                      </div>
                    </Section>
                  </div>
                </SectionGroup>

                {/* Психографика */}
                <SectionGroup title="Психографика" pillClass="bg-violet-500/10 text-violet-700 dark:text-violet-400" borderColor="border-violet-500/40">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Section title="Стиль и риск">
                      <p className="text-sm text-foreground/80 leading-relaxed mb-4">{persona.psycho.style}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">{persona.psycho.risk}</p>
                    </Section>
                    <Section title="Триггеры (что цепляет)" className="bg-primary/5 border-primary/20">
                      <ul className="space-y-3">
                        {persona.psycho.triggers.map((t, i) => (
                          <li key={i} className="flex items-start gap-3 text-foreground/90 font-medium">
                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="Красные флаги (Red Flags)" className="bg-destructive/5 border-destructive/20">
                      <ul className="space-y-3">
                        {persona.psycho.redFlags.map((t, i) => (
                          <li key={i} className="flex items-start gap-3 text-foreground/90 font-medium">
                            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </div>
                </SectionGroup>
              </div>
            )}

            {/* ── ФРАЗЫ ── */}
            {activeTab === "phrases" && (
              <div className="space-y-4">
                {persona.phrases.map((ph, i) => (
                  <div
                    key={i}
                    className="p-6 rounded-2xl bg-card border border-border shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-4 right-4 w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center relative z-10">
                      <Quote className="w-5 h-5 text-primary/30" />
                    </div>
                    <p className="text-xl font-display font-medium text-foreground/90 italic relative z-10">"{ph}"</p>
                    <p className="text-xs text-muted-foreground mt-3 font-medium relative z-10">— {persona.name}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Key input (triggered from delete actions on any tab) ── */}
            {showKeyInput && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center gap-3"
              >
                <KeyRound className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-1">Введите ключ доступа для редактирования</p>
                  {keyError && (
                    <p className="text-xs text-destructive mb-1">Неверный ключ. Попробуйте ещё раз.</p>
                  )}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    ref={keyInputRef}
                    type="password"
                    value={keyInput}
                    onChange={(e) => { setKeyInput(e.target.value); setKeyError(false); }}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                    placeholder="Ключ доступа…"
                    className="flex-1 sm:w-48 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={handleUnlock}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Войти
                  </button>
                  <button
                    onClick={() => { setShowKeyInput(false); setKeyInput(""); setKeyError(false); }}
                    className="px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── МНЕНИЯ ── */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                {regularNotes.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (apiKey) { setApiKey(""); } else { setShowKeyInput(true); setTimeout(() => keyInputRef.current?.focus(), 50); }
                      }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
                    >
                      {apiKey ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {apiKey ? "Заблокировать" : "Разблокировать удаление"}
                    </button>
                  </div>
                )}
                {notesLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Загрузка мнений…</span>
                  </div>
                ) : regularNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border">
                      <StickyNote className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg text-foreground mb-1">Мнений пока нет</p>
                      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                        Мнения появляются когда Chrome-расширение сохраняет мнения или клипы.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {regularNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        personaFirstName={personaFirstName}
                        onDelete={handleDeleteNote}
                        deleting={deletingIds.has(note.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* ── КОНТЕКСТ ── */}
            {activeTab === "context" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  <strong>Как это работает:</strong> добавленный здесь контекст автоматически включается в системный промпт при генерации мнений и интервью. Персона будет «знать» эту информацию и учитывать её в ответах.
                </div>
                {contextNotes.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (apiKey) { setApiKey(""); } else { setShowKeyInput(true); setTimeout(() => keyInputRef.current?.focus(), 50); }
                      }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
                    >
                      {apiKey ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {apiKey ? "Заблокировать" : "Разблокировать удаление"}
                    </button>
                  </div>
                )}
                {notesLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Загрузка контекста…</span>
                  </div>
                ) : contextNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border">
                      <Brain className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg text-foreground mb-1">Контекст не добавлен</p>
                      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                        Отправляйте заметки с типом «context» через Chrome-расширение — они обновят знания персоны.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {contextNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        personaFirstName={personaFirstName}
                        onDelete={handleDeleteNote}
                        deleting={deletingIds.has(note.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* ── ИНТЕРВЬЮ (archive) ── */}
            {activeTab === "archive" && (
              <div className="space-y-4">
                {interviewsLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Загрузка интервью…</span>
                  </div>
                ) : (interviewList ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border">
                      <Clock className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg text-foreground mb-1">Интервью ещё не проводились</p>
                      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                        Начните сессию во вкладке «Интервью» — каждый завершённый разговор автоматически сохраняется здесь.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {(interviewList ?? []).map((iv) => (
                      <motion.div
                        key={iv.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: deletingInterviewIds.has(iv.id) ? 0 : 1, y: 0, scale: deletingInterviewIds.has(iv.id) ? 0.97 : 1 }}
                        exit={{ opacity: 0, scale: 0.97, y: -5 }}
                        transition={{ duration: 0.2 }}
                        className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                              <MessageSquare className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-display font-semibold text-foreground text-sm">
                                {new Date(iv.createdAt).toLocaleDateString("ru-RU", {
                                  day: "numeric", month: "long", year: "numeric",
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">{iv.messageCount} сообщений</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownloadInterview(iv)}
                              className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary"
                              title="Скачать"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInterview(iv.id)}
                              disabled={deletingInterviewIds.has(iv.id)}
                              className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-secondary disabled:opacity-40"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {iv.summary ? (
                          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary">Саммари</span>
                              <button
                                onClick={() => handleGenerateSummary(iv.id)}
                                disabled={summaryLoading.has(iv.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                              >
                                {summaryLoading.has(iv.id) ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                Обновить саммари
                              </button>
                            </div>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => (
                                  <h1 className="flex items-center gap-2 text-sm font-bold text-foreground mt-5 mb-2 first:mt-0">
                                    <span className="flex-1 h-px bg-primary/20" />
                                    <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs uppercase tracking-wide">{children}</span>
                                    <span className="flex-1 h-px bg-primary/20" />
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="flex items-center gap-2 text-sm font-bold text-foreground mt-5 mb-2 first:mt-0">
                                    <span className="flex-1 h-px bg-primary/20" />
                                    <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs uppercase tracking-wide">{children}</span>
                                    <span className="flex-1 h-px bg-primary/20" />
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 mt-4 mb-1.5 first:mt-0">{children}</h3>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-3 rounded-xl border border-primary/15">
                                    <table className="w-full border-collapse text-sm">{children}</table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="bg-primary/10">{children}</thead>
                                ),
                                th: ({ children }) => (
                                  <th className="border border-primary/20 px-3 py-2 text-left font-semibold text-foreground">{children}</th>
                                ),
                                td: ({ children }) => (
                                  <td className="border border-primary/10 px-3 py-2 text-foreground/90">{children}</td>
                                ),
                                tr: ({ children }) => (
                                  <tr className="even:bg-primary/5">{children}</tr>
                                ),
                                p: ({ children }) => <p className="text-sm text-foreground/90 leading-relaxed mb-2 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="pl-5 mb-2 space-y-1 text-sm text-foreground/90">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm text-foreground/90">{children}</ol>,
                                li: ({ children, className }) => {
                                  const isTask = className?.includes("task-list-item");
                                  return (
                                    <li className={cn(isTask ? "flex items-start gap-2 list-none -ml-5" : "list-disc")}>
                                      {children}
                                    </li>
                                  );
                                },
                                input: ({ type, checked }) =>
                                  type === "checkbox" ? (
                                    <span className={cn(
                                      "inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 mt-0.5",
                                      checked
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-border bg-background"
                                    )}>
                                      {checked && <span className="text-[10px] leading-none">✓</span>}
                                    </span>
                                  ) : null,
                                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
                                hr: () => <hr className="my-4 border-border/50" />,
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-primary/30 pl-3 my-2 text-foreground/70 italic text-sm">{children}</blockquote>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>
                                ),
                              }}
                            >
                              {iv.summary}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGenerateSummary(iv.id)}
                            disabled={summaryLoading.has(iv.id)}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
                          >
                            {summaryLoading.has(iv.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            {summaryLoading.has(iv.id) ? "Генерация саммари…" : "Сгенерировать саммари"}
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string, children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("p-6 md:p-8 rounded-3xl border border-border bg-card shadow-sm", className)}>
      <h3 className="font-display font-bold text-xl mb-4 text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function SectionGroup({ title, pillClass, borderColor, children }: { title: string; pillClass: string; borderColor: string; children: React.ReactNode }) {
  return (
    <div className={cn("pl-5 border-l-4", borderColor)}>
      <div className="flex items-center gap-3 mb-4">
        <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider", pillClass)}>
          {title}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex-1 p-5 rounded-2xl bg-secondary/30 border border-border flex items-start gap-4">
      <div className="p-2.5 bg-card rounded-xl shadow-sm border border-border/50 text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
        <div className="font-medium text-foreground/90 text-sm leading-relaxed">{value}</div>
      </div>
    </div>
  );
}

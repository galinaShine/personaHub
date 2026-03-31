import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePersonas } from "@/hooks/use-personas";
import { Dossier } from "@/components/Dossier";
import { Interview } from "@/components/Interview";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutPanelLeft, MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIndustryColor } from "@/lib/persona-colors";
import { useLocation } from "wouter";

export default function Home() {
  const initialId = new URLSearchParams(window.location.search).get("persona");
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [view, setView] = useState<"dossier" | "interview">("dossier");
  const { personas } = usePersonas();
  const [, navigate] = useLocation();

  const selectedPersona = personas.find(p => p.id === selectedId) || null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar 
        selectedId={selectedId} 
        onSelect={(id) => {
          setSelectedId(id);
          setView("dossier"); // Reset view when selecting new persona
        }} 
      />

      <main className="flex-1 flex flex-col relative h-full bg-secondary/10">
        {selectedPersona ? (
          <>
            {/* Top Navigation Bar */}
            <div className="h-16 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm">
                  {selectedPersona.name.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-foreground leading-none">{selectedPersona.name}</div>
                  <div className="text-[11px] font-medium text-muted-foreground mt-0.5">{selectedPersona.role}</div>
                </div>
              </div>

              <div className="flex p-1 bg-secondary rounded-xl border border-border/50">
                <button
                  onClick={() => setView("dossier")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200",
                    view === "dossier" 
                      ? "bg-card text-foreground shadow-sm border border-border/50" 
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  )}
                >
                  <LayoutPanelLeft className="w-4 h-4" />
                  Досье
                </button>
                <button
                  onClick={() => setView("interview")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200",
                    view === "interview" 
                      ? "bg-card text-foreground shadow-sm border border-border/50" 
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  Интервью
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {view === "dossier" ? (
                  <motion.div
                    key="dossier"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <Dossier persona={selectedPersona} onDelete={() => setSelectedId(null)} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="interview"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <Interview persona={selectedPersona} onFinish={() => setView("dossier")} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background overflow-y-auto">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                  Добро пожаловать в PersonaHub
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Выберите персону для просмотра досье или AI-интервью
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personas.map((p) => {
                  const color = getIndustryColor(p.tags);
                  const initials = p.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all text-left group"
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-lg shrink-0",
                        color.avatarBg,
                        color.avatarText
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-foreground text-base">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{p.role}</div>
                        <div className="text-xs font-medium text-muted-foreground/70 truncate">{p.company}</div>
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full group-hover:bg-primary/20 transition-colors">
                            Открыть досье
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate("/import")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Или импортируйте новую персону из Claude Chat →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

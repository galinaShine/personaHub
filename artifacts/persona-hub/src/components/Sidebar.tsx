import { useState } from "react";
import { motion } from "framer-motion";
import { Search, UserRound, Upload } from "lucide-react";
import { usePersonas } from "@/hooks/use-personas";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { getIndustryColor } from "@/lib/persona-colors";

interface SidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export function Sidebar({ selectedId, onSelect }: SidebarProps) {
  const { personas } = usePersonas();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? personas.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : personas;

  return (
    <div className="w-80 lg:w-96 flex flex-col bg-card border-r border-border h-full z-10 relative">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xl shadow-inner shadow-black/20">
            P
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight text-foreground">
              PersonaHub
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Библиотека персон + интервью
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск персон..."
            className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
          <UserRound className="w-3.5 h-3.5" />
          {searchQuery.trim()
            ? `${filtered.length} из ${personas.length}`
            : "Доступные персоны"}
        </div>

        {filtered.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            Персоны не найдены
          </div>
        )}

        {filtered.map((p, idx) => {
          const isActive = selectedId === p.id;
          const color = getIndustryColor(p.tags);
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelect(p.id)}
              className={cn(
                "w-full text-left p-3 rounded-2xl transition-all duration-200 group relative border",
                isActive
                  ? cn("shadow-sm", color.activeBg, color.activeBorder)
                  : "bg-transparent border-transparent hover:bg-secondary/60 hover:border-border"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className={cn(
                    "absolute left-0 top-3 bottom-3 w-1 rounded-r-full",
                    color.accentBar
                  )}
                />
              )}

              <div className="flex gap-3">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-sm shadow-sm transition-colors shrink-0",
                    color.avatarBg,
                    color.avatarText
                  )}
                >
                  {getInitials(p.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-foreground truncate text-base">
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mb-2 mt-0.5">
                    {p.role} · <span className="font-medium text-foreground/80">{p.company}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-background border border-border/50 rounded-md text-[10px] font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {t}
                      </span>
                    ))}
                    {p.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-background border border-border/50 rounded-md text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                        +{p.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card/50">
        <button
          onClick={() => navigate("/import")}
          className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground bg-secondary/50 hover:bg-secondary py-2.5 rounded-lg border border-border/50 transition-colors w-full"
        >
          <Upload className="w-3.5 h-3.5 text-primary" />
          Импорт из Claude Chat
        </button>
      </div>
    </div>
  );
}

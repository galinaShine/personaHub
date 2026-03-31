import { useState, useRef, useEffect } from "react";
import { Persona } from "@/data/personas";
import { useInterview } from "@/hooks/use-interview";
import { Send, UserRound, Sparkles, Loader2, Bot, RotateCcw, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface InterviewProps {
  persona: Persona;
  onFinish?: () => void;
}

export function Interview({ persona, onFinish }: InterviewProps) {
  const { messages, isStreaming, error, startInterview, clearSession, sendMessage, isReady } =
    useInterview(persona);
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    startInterview();
  }, [persona.id]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !isReady) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFinish = () => {
    clearSession();
    queryClient.invalidateQueries({ queryKey: ["interviews", persona.id] });
    onFinish?.();
  };

  const handleRestart = () => {
    clearSession();
    queryClient.invalidateQueries({ queryKey: ["interviews", persona.id] });
    startInterview(true);
  };

  const displayMessages = messages.filter((m) => m.role !== "system");
  const systemMsg = messages.find((m) => m.role === "system");

  return (
    <div className="flex-1 flex flex-col bg-background relative overflow-hidden h-full">
      {/* Chat Header Background Effect */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Session Action Bar */}
      {isReady && (
        <div className="relative z-20 flex items-center justify-end gap-2 px-4 md:px-6 py-2 border-b border-border/50 bg-card/60 backdrop-blur-sm">
          <button
            onClick={handleRestart}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Начать разговор заново"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Начать заново
          </button>
          <button
            onClick={handleFinish}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary-foreground hover:bg-primary rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Завершить интервью и вернуться к досье"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Завершить интервью
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative z-10">
        {!isReady && !error && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-medium animate-pulse">Инициализация AI-симуляции...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-center font-medium max-w-lg mx-auto">
            Ошибка соединения: {error}. Пожалуйста, обновите страницу.
          </div>
        )}

        {isReady && (
          <div className="max-w-3xl mx-auto space-y-8 pb-4">
            {systemMsg && (
              <div className="flex justify-center">
                <div className="bg-secondary/50 border border-border/50 px-5 py-2.5 rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {systemMsg.content}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {displayMessages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn("flex gap-4 w-full", isUser ? "flex-row-reverse" : "flex-row")}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
                        isUser
                          ? "bg-foreground text-background border-foreground"
                          : "bg-primary text-primary-foreground border-primary/20",
                      )}
                    >
                      {isUser ? <UserRound className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>

                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-sm md:text-base leading-relaxed",
                        isUser
                          ? "bg-foreground text-background rounded-tr-sm whitespace-pre-wrap"
                          : "bg-card border border-border text-card-foreground rounded-tl-sm",
                      )}
                    >
                      {!msg.content && isStreaming && idx === displayMessages.length - 1 ? (
                        <span className="flex items-center gap-1 h-6">
                          <span
                            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </span>
                      ) : isUser ? (
                        msg.content
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-3">
                                <table className="w-full border-collapse text-sm">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-primary/10">{children}</thead>
                            ),
                            th: ({ children }) => (
                              <th className="border border-border px-3 py-2 text-left font-semibold text-foreground">{children}</th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-border px-3 py-2 text-foreground/90">{children}</td>
                            ),
                            tr: ({ children }) => (
                              <tr className="even:bg-secondary/30">{children}</tr>
                            ),
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            code: ({ children }) => (
                              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={endOfMessagesRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-card border-t border-border z-20">
        <div className="max-w-3xl mx-auto relative">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end shadow-sm bg-background border-2 border-border focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 rounded-2xl transition-all duration-200"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Написать сообщение...`}
              className="w-full max-h-32 min-h-[60px] bg-transparent resize-none outline-none p-4 pr-16 text-foreground placeholder:text-muted-foreground/60 rounded-2xl"
              rows={1}
              disabled={!isReady || isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || !isReady || isStreaming}
              className="absolute right-3 bottom-3 p-2.5 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md shadow-primary/20 disabled:shadow-none"
            >
              {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
          <div className="text-center mt-3 text-[11px] font-medium text-muted-foreground">
            Shift + Enter для переноса строки
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef } from "react";
import { Persona } from "@/data/personas";

export type MessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

interface SessionData {
  messages: ChatMessage[];
  sessionId: string;
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function sessionKey(personaId: string) {
  return `interview-session-${personaId}`;
}

function loadSessionData(personaId: string): SessionData | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(personaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.messages) &&
      parsed.messages.length > 0 &&
      typeof parsed.sessionId === "string"
    ) {
      return parsed as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSessionData(personaId: string, data: SessionData) {
  try {
    sessionStorage.setItem(sessionKey(personaId), JSON.stringify(data));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

function clearSessionStorage(personaId: string) {
  try {
    sessionStorage.removeItem(sessionKey(personaId));
  } catch {
    // ignore
  }
}

export function useInterview(persona: Persona | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionIdRef = useRef<string>("");

  const updateMessages = useCallback(
    (next: ChatMessage[]) => {
      messagesRef.current = next;
      setMessages(next);
      if (persona) {
        saveSessionData(persona.id, { messages: next, sessionId: sessionIdRef.current });
      }
    },
    [persona],
  );

  const startInterview = useCallback(
    (force = false) => {
      if (!persona) return;

      if (!force) {
        const saved = loadSessionData(persona.id);
        if (saved) {
          sessionIdRef.current = saved.sessionId;
          messagesRef.current = saved.messages;
          setMessages(saved.messages);
          setError(null);
          setIsReady(true);
          return;
        }
      }

      const newSessionId = crypto.randomUUID();
      sessionIdRef.current = newSessionId;

      const initial: ChatMessage[] = [
        {
          id: "sys-1",
          role: "system",
          content: `Интервью с ${persona.name} (${persona.role}, ${persona.company}). Вы — исследователь. Представьтесь и начните разговор.`,
        },
      ];
      clearSessionStorage(persona.id);
      saveSessionData(persona.id, { messages: initial, sessionId: newSessionId });
      messagesRef.current = initial;
      setMessages(initial);
      setError(null);
      setIsReady(true);
    },
    [persona],
  );

  const clearSession = useCallback(() => {
    if (!persona) return;
    clearSessionStorage(persona.id);
    sessionIdRef.current = "";
    messagesRef.current = [];
    setMessages([]);
    setIsReady(false);
    setError(null);
  }, [persona]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !persona || isStreaming) return;

      const userMsgId = Date.now().toString();
      const assistantMsgId = (Date.now() + 1).toString();

      const userMsg: ChatMessage = { id: userMsgId, role: "user", content };
      const assistantMsg: ChatMessage = { id: assistantMsgId, role: "assistant", content: "" };

      const updatedMessages = [...messagesRef.current, userMsg, assistantMsg];
      updateMessages(updatedMessages);

      setIsStreaming(true);
      setError(null);

      const apiMessages = [...messagesRef.current]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => !(m.id === assistantMsgId))
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      try {
        const response = await fetch(`${API_BASE}/api/personas/${persona.id}/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, sessionId: sessionIdRef.current || undefined }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let accumulatedContent = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.substring(6);
                try {
                  const data = JSON.parse(dataStr);
                  if (data.done) {
                    done = true;
                  } else if (data.content) {
                    accumulatedContent += data.content;
                    setMessages((prev) => {
                      const next = prev.map((msg) =>
                        msg.id === assistantMsgId ? { ...msg, content: accumulatedContent } : msg,
                      );
                      messagesRef.current = next;
                      if (persona) {
                        saveSessionData(persona.id, { messages: next, sessionId: sessionIdRef.current });
                      }
                      return next;
                    });
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setMessages((prev) => {
          const next = prev.filter((msg) => msg.id !== assistantMsgId);
          messagesRef.current = next;
          if (persona) {
            saveSessionData(persona.id, { messages: next, sessionId: sessionIdRef.current });
          }
          return next;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [persona, isStreaming, updateMessages],
  );

  return {
    messages,
    isStreaming,
    error,
    startInterview,
    clearSession,
    sendMessage,
    isReady,
  };
}

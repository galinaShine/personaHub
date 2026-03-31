import { useQuery } from "@tanstack/react-query";
import { PERSONAS, Persona } from "@/data/personas";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ApiPersonaData {
  age?: string;
  location?: string;
  education?: string;
  experience?: string;
  industry?: string;
  tags?: string[];
  career?: string;
  careerPath?: string;
  situation?: string;
  currentSituation?: string;
  goals?: { professional?: string[]; personal?: string[] };
  pains?: { pain: string; severity: "critical" | "high" | "medium" | "low"; detail: string }[];
  decisions?: { criteria?: string[]; influence?: string[]; procCycle?: string; budget?: string };
  info?: { sources?: string[]; trusted?: string[] };
  psycho?: { style?: string; risk?: string; triggers?: string[]; redFlags?: string[] };
  phrases?: string[];
  interviewConfig?: { resistanceLevel?: string; purpose?: string; specialNotes?: string };
  [key: string]: unknown;
}

interface ApiPersona {
  id: string;
  name: string;
  role: string;
  company: string;
  data: ApiPersonaData | null;
  createdAt: string;
}

function apiToPersona(apiP: ApiPersona): Persona {
  const d: ApiPersonaData = apiP.data ?? {};
  return {
    id: apiP.id,
    name: apiP.name,
    role: apiP.role,
    company: apiP.company,
    age: d.age ?? "",
    location: d.location ?? "",
    education: d.education ?? "",
    experience: d.experience ?? "",
    industry: d.industry ?? "",
    tags: d.tags ?? [],
    career: d.career ?? d.careerPath ?? "",
    situation: d.situation ?? d.currentSituation ?? "",
    goals: {
      professional: d.goals?.professional ?? [],
      personal: d.goals?.personal ?? [],
    },
    pains: d.pains ?? [],
    decisions: {
      criteria: d.decisions?.criteria ?? [],
      influence: d.decisions?.influence ?? [],
      procCycle: d.decisions?.procCycle ?? "",
      budget: d.decisions?.budget ?? "",
    },
    info: {
      sources: d.info?.sources ?? [],
      trusted: d.info?.trusted ?? [],
    },
    psycho: {
      style: d.psycho?.style ?? "",
      risk: d.psycho?.risk ?? "",
      triggers: d.psycho?.triggers ?? [],
      redFlags: d.psycho?.redFlags ?? [],
    },
    phrases: d.phrases ?? [],
  };
}

export function usePersonas(): { personas: Persona[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<ApiPersona[]>({
    queryKey: ["personas"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas`);
      if (!res.ok) throw new Error("Failed to fetch personas");
      return res.json();
    },
    staleTime: 30_000,
  });

  if (!data || isLoading) {
    return { personas: PERSONAS, isLoading };
  }

  const merged = data.map((apiP) => {
    const staticP = PERSONAS.find((p) => p.id === apiP.id);
    if (staticP) return staticP;
    return apiToPersona(apiP);
  });

  return { personas: merged, isLoading: false };
}

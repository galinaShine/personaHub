export interface IndustryColor {
  avatarBg: string;
  avatarText: string;
  accentBar: string;
  activeBg: string;
  activeBorder: string;
}

export function getIndustryColor(tags: string[]): IndustryColor {
  const str = tags.join(",").toLowerCase();
  if (/banking|finance|bank|fintech/.test(str)) {
    return {
      avatarBg: "bg-blue-100 dark:bg-blue-950",
      avatarText: "text-blue-700 dark:text-blue-400",
      accentBar: "bg-blue-500",
      activeBg: "bg-blue-500/5",
      activeBorder: "border-blue-500/20",
    };
  }
  if (/aviation|airline|avia|flight|transport/.test(str)) {
    return {
      avatarBg: "bg-emerald-100 dark:bg-emerald-950",
      avatarText: "text-emerald-700 dark:text-emerald-400",
      accentBar: "bg-emerald-500",
      activeBg: "bg-emerald-500/5",
      activeBorder: "border-emerald-500/20",
    };
  }
  if (/tech|\bai\b|ai-transformation|chatbot|nlp|machine.?learning/.test(str)) {
    return {
      avatarBg: "bg-violet-100 dark:bg-violet-950",
      avatarText: "text-violet-700 dark:text-violet-400",
      accentBar: "bg-violet-500",
      activeBg: "bg-violet-500/5",
      activeBorder: "border-violet-500/20",
    };
  }
  if (/retail|ecommerce|shop|trade/.test(str)) {
    return {
      avatarBg: "bg-orange-100 dark:bg-orange-950",
      avatarText: "text-orange-700 dark:text-orange-400",
      accentBar: "bg-orange-500",
      activeBg: "bg-orange-500/5",
      activeBorder: "border-orange-500/20",
    };
  }
  return {
    avatarBg: "bg-slate-100 dark:bg-slate-800",
    avatarText: "text-slate-600 dark:text-slate-300",
    accentBar: "bg-slate-400",
    activeBg: "bg-slate-500/5",
    activeBorder: "border-slate-400/20",
  };
}

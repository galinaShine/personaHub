document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get(["api_base", "api_secret", "pendingAction"]);
  document.getElementById("base").value = data.api_base || "";
  document.getElementById("secret").value = data.api_secret || "";

  const apiBase = (data.api_base || "").replace(/\/+$/, "");
  const apiSecret = data.api_secret || "";

  // ── Show quick-action panel if there's a pending context action ──
  const pending = data.pendingAction;
  if (pending && pending.text && pending.type === "context") {
    const actionSection = document.getElementById("action-section");
    const actionText = document.getElementById("action-text");
    const personaSelect = document.getElementById("action-persona");
    const statusEl = document.getElementById("action-status");

    actionSection.classList.add("visible");
    actionText.textContent = pending.text.substring(0, 150) + (pending.text.length > 150 ? "…" : "");

    // Load personas into select
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/personas`);
        const personas = await res.json();
        personaSelect.innerHTML = personas.map(p =>
          `<option value="${p.id}">${p.name} — ${p.role || ''}</option>`
        ).join('');
      } catch {
        personaSelect.innerHTML = `<option>Ошибка загрузки персон</option>`;
      }
    }

    document.getElementById("btn-context").onclick = async () => {
      const personaId = personaSelect.value;
      if (!personaId || !apiBase || !apiSecret) {
        statusEl.textContent = "Укажите URL сайта и секрет в настройках ниже.";
        statusEl.className = "action-status err";
        return;
      }
      statusEl.textContent = "Сохраняю в контекст…";
      statusEl.className = "action-status ok";

      try {
        const r = await fetch(`${apiBase}/api/personas/${personaId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiSecret}`
          },
          body: JSON.stringify({
            type: "context",
            personaId,
            sourceUrl: pending.url || "",
            sourceText: pending.text
          })
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        statusEl.textContent = "✓ Добавлено в контекст!";
        statusEl.className = "action-status ok";
        await chrome.storage.local.remove("pendingAction");
      } catch (e) {
        statusEl.textContent = `✗ Ошибка: ${e.message}`;
        statusEl.className = "action-status err";
      }
    };
  }

  // ── Settings save & verify ──
  document.getElementById("save").onclick = async () => {
    const base = document.getElementById("base").value.replace(/\/+$/, "");
    const secret = document.getElementById("secret").value;
    const statusEl = document.getElementById("status");

    await chrome.storage.local.set({ api_base: base, api_secret: secret });

    statusEl.textContent = "Проверяю подключение…";
    statusEl.className = "status";

    try {
      const res = await fetch(`${base}/api/personas`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const personas = await res.json();
      statusEl.textContent = `✓ Подключено! ${personas.length} персон в библиотеке.`;
      statusEl.className = "status ok";
    } catch (e) {
      statusEl.textContent = `✗ Ошибка: ${e.message}`;
      statusEl.className = "status err";
    }
  };
});

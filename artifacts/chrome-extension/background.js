// ══════════════════════════════════════
// PersonaHub Chrome Extension - Background Service Worker
// ══════════════════════════════════════

// ── Context Menu Setup ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ph-opinion",
    title: "🗣 Спросить мнение персоны",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "ph-context",
    title: "📌 Добавить в контекст персоны",
    contexts: ["selection"]
  });
});

// ── Handle Context Menu Clicks ──
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText || !tab?.id) return;

  let actionType;
  if (info.menuItemId === "ph-opinion") actionType = "opinion";
  else if (info.menuItemId === "ph-context") actionType = "context";
  else return;

  // Store pending action
  await chrome.storage.local.set({
    pendingAction: {
      type: actionType,
      text: selectedText,
      url: tab.url || "",
      pageTitle: tab.title || ""
    }
  });

  // Inject the persona selector panel into the page
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectPersonaPanel,
    args: [actionType, selectedText]
  });
});

// ── Listen for messages from injected script ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ph-get-config") {
    chrome.storage.local.get(["api_base", "api_secret"], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (msg.type === "ph-get-personas") {
    chrome.storage.local.get(["api_base"], async (data) => {
      try {
        const res = await fetch(`${data.api_base}/api/personas`);
        const personas = await res.json();
        sendResponse({ ok: true, personas });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }

  if (msg.type === "ph-opinion") {
    chrome.storage.local.get(["api_base", "api_secret"], async (data) => {
      try {
        const res = await fetch(`${data.api_base}/api/personas/${msg.personaId}/opinion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.api_secret}`
          },
          body: JSON.stringify({
            type: "opinion",
            sourceUrl: msg.sourceUrl,
            sourceText: msg.sourceText
          })
        });
        const result = await res.json();
        sendResponse({ ok: true, reply: result.opinion });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }

  if (msg.type === "ph-context") {
    chrome.storage.local.get(["api_base", "api_secret"], async (data) => {
      try {
        await fetch(`${data.api_base}/api/personas/${msg.personaId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.api_secret}`
          },
          body: JSON.stringify({
            type: "context",
            personaId: msg.personaId,
            sourceUrl: msg.sourceUrl,
            sourceText: msg.sourceText
          })
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }
});

// ══════════════════════════════════════
// Injected function — runs IN the webpage
// ══════════════════════════════════════
function injectPersonaPanel(actionType, selectedText) {
  // Escape HTML to prevent XSS when inserting into innerHTML
  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Remove existing panel
  const old = document.getElementById("ph-panel");
  if (old) old.remove();

  // Create panel
  const panel = document.createElement("div");
  panel.id = "ph-panel";
  panel.style.cssText = `
    position:fixed; top:0; right:0; width:360px; height:100vh;
    background:#F8F7F4; box-shadow:-4px 0 24px rgba(0,0,0,0.12);
    z-index:2147483647; font-family:'Segoe UI',system-ui,sans-serif;
    overflow-y:auto; transition:transform 0.25s ease;
    border-left:1px solid #E6E3DC;
  `;

  const actionLabels = {
    opinion: "🗣 Мнение персоны",
    context: "📌 Добавить в контекст"
  };
  const actionColors = {
    opinion: "#D4380D",
    context: "#15803D"
  };

  panel.innerHTML = `
    <div style="padding:20px;border-bottom:1px solid #E6E3DC;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:28px;height:28px;border-radius:8px;background:#1A1A1A;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800">P</div>
        <div>
          <div style="font-size:13px;font-weight:700">PersonaHub</div>
          <div style="font-size:11px;color:#9E9890">${actionLabels[actionType] || actionType}</div>
        </div>
      </div>
      <button onclick="document.getElementById('ph-panel').remove()" style="border:none;background:none;cursor:pointer;font-size:18px;color:#9E9890;padding:4px">✕</button>
    </div>
    <div style="padding:16px">
      <div style="font-size:11px;color:#9E9890;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Выбранный текст</div>
      <div style="background:white;border:1px solid #E6E3DC;border-radius:9px;padding:10px 12px;font-size:12.5px;color:#6B6560;line-height:1.55;max-height:90px;overflow-y:auto">${esc(selectedText)}</div>
    </div>
    <div style="padding:0 16px">
      <div style="font-size:11px;color:#9E9890;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Выберите персону</div>
      <div id="ph-personas" style="display:flex;flex-direction:column;gap:8px">
        <div style="text-align:center;padding:20px;color:#9E9890;font-size:12px">Загрузка персон…</div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Load personas
  chrome.runtime.sendMessage({ type: "ph-get-personas" }, (res) => {
    const container = document.getElementById("ph-personas");
    if (!container) return;

    if (!res?.ok || !res.personas?.length) {
      container.innerHTML = `<div style="color:#D4380D;font-size:12px;text-align:center;padding:10px">Ошибка загрузки персон. Проверьте настройки.</div>`;
      return;
    }

    container.innerHTML = res.personas.map(p => `
      <div class="ph-card" data-id="${p.id}" data-name="${p.name}" style="
        background:white; border:1.5px solid rgba(0,0,0,0.06); border-radius:12px;
        padding:12px 14px; cursor:pointer; transition:all 0.15s;
      ">
        <div style="font-size:13px;font-weight:600;color:#1A1A1A">${p.name}</div>
        <div style="font-size:11px;color:#9E9890;margin-top:2px">${p.role || ''}</div>
      </div>
    `).join('');

    // Bind clicks
    container.querySelectorAll(".ph-card").forEach(card => {
      card.onmouseover = () => { card.style.borderColor = actionColors[actionType] || "#D4380D"; card.style.transform = "translateY(-1px)"; };
      card.onmouseout = () => { card.style.borderColor = "rgba(0,0,0,0.06)"; card.style.transform = "none"; };

      card.onclick = () => {
        const pid = card.dataset.id;
        const pname = card.dataset.name;

        const loadingText = actionType === "opinion" ? "Генерирую мнение…" : "Сохраняю в контекст…";
        card.innerHTML = `<div style="padding:4px;color:${actionColors[actionType] || '#D4380D'};font-size:12px">⏳ ${loadingText}</div>`;

        if (actionType === "opinion") {
          chrome.runtime.sendMessage({
            type: "ph-opinion",
            personaId: pid,
            sourceText: selectedText,
            sourceUrl: window.location.href
          }, (res) => {
            if (res?.ok) {
              card.innerHTML = `
                <div style="padding:4px">
                  <div style="font-size:12px;font-weight:600;color:#1A1A1A;margin-bottom:6px">${pname}:</div>
                  <div style="font-size:12.5px;color:#6B6560;line-height:1.55">${res.reply}</div>
                  <div style="font-size:11px;color:#15803D;margin-top:8px;font-weight:600">✓ Сохранено в досье</div>
                </div>`;
              card.style.borderColor = "#15803D";
            } else {
              card.innerHTML = `<div style="color:#D4380D;font-size:12px">⚠ Ошибка: ${res?.error || 'unknown'}</div>`;
            }
          });
        } else {
          chrome.runtime.sendMessage({
            type: "ph-context",
            personaId: pid,
            sourceText: selectedText,
            sourceUrl: window.location.href
          }, (res) => {
            if (res?.ok) {
              card.innerHTML = `<div style="padding:4px;font-size:12px;color:#15803D;font-weight:600">✓ Добавлено в контекст ${pname}</div>`;
              card.style.borderColor = "#15803D";
            } else {
              card.innerHTML = `<div style="color:#D4380D;font-size:12px">⚠ Ошибка</div>`;
            }
          });
        }
      };
    });
  });
}

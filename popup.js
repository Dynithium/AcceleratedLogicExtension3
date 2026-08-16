// AcceleratedLogic AI - Popup Controller

// Polyfill chrome APIs for browser preview & standalone execution
if (typeof window !== "undefined") {
  if (typeof window.chrome === "undefined") {
    window.chrome = {};
  }
  if (!window.chrome.storage || !window.chrome.storage.local) {
    window.chrome.storage = {
      local: {
        get: (keys, callback) => {
          const result = {};
          const keyList = Array.isArray(keys) ? keys : (typeof keys === "string" ? [keys] : Object.keys(keys || {}));
          for (const k of keyList) {
            const val = localStorage.getItem("al_ai_" + k);
            if (val !== null) {
              try {
                result[k] = JSON.parse(val);
              } catch (e) {
                result[k] = val;
              }
            }
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          for (const [k, v] of Object.entries(items || {})) {
            localStorage.setItem("al_ai_" + k, JSON.stringify(v));
          }
          if (callback) callback();
          return Promise.resolve();
        }
      }
    };
  }
  if (!window.chrome.tabs) {
    window.chrome.tabs = {
      query: (queryInfo, callback) => {
        const tabs = [{
          id: 1,
          title: document.title || "AcceleratedLogic AI",
          url: window.location.href,
          active: true
        }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      },
      sendMessage: (tabId, message, callback) => {
        if (callback) callback({ status: "ok" });
        return Promise.resolve({ status: "ok" });
      },
      update: (tabId, updateProps, callback) => {
        if (callback) callback({ id: tabId, ...updateProps });
        return Promise.resolve({ id: tabId, ...updateProps });
      },
      create: (createProps, callback) => {
        if (createProps && createProps.url) window.open(createProps.url, "_blank");
        if (callback) callback({ id: 2, ...createProps });
        return Promise.resolve({ id: 2, ...createProps });
      },
      captureVisibleTab: (windowId, options, callback) => {
        // Return dummy transparent 1x1 png canvas data if running outside extension
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 200;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(0, 0, 300, 200);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "14px sans-serif";
          ctx.fillText("Tab Viewport Preview", 80, 105);
        }
        const dataUrl = canvas.toDataURL("image/png");
        if (callback) callback(dataUrl);
        return Promise.resolve(dataUrl);
      }
    };
  }
  if (!window.chrome.scripting) {
    window.chrome.scripting = {
      executeScript: (injection, callback) => {
        const res = [{ result: { title: document.title, url: window.location.href, text: "AcceleratedLogic AI context" } }];
        if (callback) callback(res);
        return Promise.resolve(res);
      }
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const btnSettings = document.getElementById("btn-settings");
  const settingsPane = document.getElementById("settings-pane");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const inputApiKey = document.getElementById("input-api-key");
  const btnToggleKeyVisibility = document.getElementById("btn-toggle-key-visibility");
  const selectModel = document.getElementById("select-model");
  const customModelGroup = document.getElementById("custom-model-group");
  const inputCustomModel = document.getElementById("input-custom-model");

  // OpenAI-Compatible Elements
  const selectProvider = document.getElementById("select-provider");
  const geminiSettingsGroup = document.getElementById("gemini-settings-group");
  const openaiSettingsGroup = document.getElementById("openai-settings-group");
  const inputOpenaiBaseUrl = document.getElementById("input-openai-base-url");
  const inputOpenaiApiKey = document.getElementById("input-openai-api-key");
  const btnToggleOpenaiKeyVisibility = document.getElementById("btn-toggle-openai-key-visibility");
  const inputOpenaiModelId = document.getElementById("input-openai-model-id");
  const btnScanOpenai = document.getElementById("btn-scan-openai");
  const openaiScanResults = document.getElementById("openai-scan-results");

  const chatLog = document.getElementById("chat-log");
  const welcomeScreen = document.getElementById("welcome-screen");
  const welcomeKeyWarning = document.getElementById("welcome-key-warning");

  const btnPlus = document.getElementById("btn-plus");
  const plusMenu = document.getElementById("plus-menu");
  const menuUploadFile = document.getElementById("menu-upload-file");
  const menuCapturePage = document.getElementById("menu-capture-page");
  const hiddenFileInput = document.getElementById("hidden-file-input");

  const attachmentPreview = document.getElementById("attachment-preview");
  const attachmentTypeIcon = document.getElementById("attachment-type-icon");
  const attachmentNameElement = document.getElementById("attachment-name");
  const attachmentSizeElement = document.getElementById("attachment-size");
  const btnRemoveAttachment = document.getElementById("btn-remove-attachment");

  const promptInput = document.getElementById("prompt-input");
  const btnSend = document.getElementById("btn-send");

  // Chats Pane DOM Elements
  const btnChats = document.getElementById("btn-chats");
  const chatsPane = document.getElementById("chats-pane");
  const btnNewChat = document.getElementById("btn-new-chat");
  const chatsList = document.getElementById("chats-list");

  // Tab Picker Modal Elements
  const tabPickerModal = document.getElementById("tab-picker-modal");
  const closeTabPicker = document.getElementById("close-tab-picker");
  const pickerTabList = document.getElementById("picker-tab-list");

  // Extension State
  let apiProvider = "gemini";
  let apiKey = "";
  let modelId = "gemini-2.5-flash";
  let openaiBaseUrl = "https://api.openai.com/v1";
  let openaiApiKey = "";
  let openaiModelId = "gpt-4o-mini";
  let openaiCapabilities = { vision: false, audio: false };

  let activeAttachment = null; // { name, size, mimeType, base64, domContext }
  let chats = []; // list of { id, title, history }
  let activeChatId = null;
  let chatHistory = []; // list of { role: 'user'|'model', parts: [{text}, {inlineData}] }
  let isGenerating = false;
  let currentAbortController = null;

  // Handle copy buttons inside code blocks (MV3 CSP Compliant)
  document.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("code-copy-btn")) {
      const btn = e.target;
      const pre = btn.nextElementSibling;
      if (pre) {
        navigator.clipboard.writeText(pre.textContent || "").then(() => {
          btn.textContent = "Copied!";
          btn.style.backgroundColor = "#10b981";
          btn.style.color = "#ffffff";
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.style.backgroundColor = "";
            btn.style.color = "";
          }, 1500);
        }).catch(err => {
          console.error("Failed to copy:", err);
        });
      }
    }
  });

  // 1. Initial Load & Hydrate Settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      "apiProvider", "apiKey", "modelId", "customModelId", "chats", "activeChatId", "chatHistory",
      "openaiBaseUrl", "openaiApiKey", "openaiModelId", "openaiCapabilities"
    ], (result) => {
      if (result.apiProvider) {
        apiProvider = result.apiProvider;
        selectProvider.value = apiProvider;
        if (apiProvider === "gemini") {
          geminiSettingsGroup.style.display = "block";
          openaiSettingsGroup.style.display = "none";
        } else {
          geminiSettingsGroup.style.display = "none";
          openaiSettingsGroup.style.display = "block";
        }
      }

      if (result.openaiBaseUrl) {
        openaiBaseUrl = result.openaiBaseUrl;
        inputOpenaiBaseUrl.value = openaiBaseUrl;
      }
      if (result.openaiApiKey) {
        openaiApiKey = result.openaiApiKey;
        inputOpenaiApiKey.value = openaiApiKey;
      }
      if (result.openaiModelId) {
        openaiModelId = result.openaiModelId;
        inputOpenaiModelId.value = openaiModelId;
      }
      if (result.openaiCapabilities) {
        openaiCapabilities = result.openaiCapabilities;
        openaiScanResults.innerHTML = `Capabilities Verified:<br>• Text: Confirmed<br>• Vision: ${openaiCapabilities.vision ? "✅ Confirmed" : "❌ Not supported"}<br>• Audio: ${openaiCapabilities.audio ? "✅ Confirmed" : "❌ Not supported"}`;
        openaiScanResults.style.color = "#6ee7a8";
      }

      const activeKey = apiProvider === "gemini" ? result.apiKey : result.openaiApiKey;
      if (activeKey) {
        apiKey = result.apiKey || "";
        inputApiKey.value = apiKey;
        welcomeKeyWarning.style.display = "none";
      } else {
        apiKey = result.apiKey || "";
        inputApiKey.value = apiKey;
        welcomeKeyWarning.style.display = "block";
        welcomeKeyWarning.textContent = apiProvider === "gemini" ? "⚠️ Please click the gear icon (⚙️) above to configure your Gemini API Key." : "⚠️ Please click the gear icon (⚙️) above to configure your OpenAI-Compatible API Key.";
      }

      if (result.modelId) {
        modelId = result.modelId;
        selectModel.value = modelId;
        if (modelId === "custom") {
          customModelGroup.style.display = "block";
          if (result.customModelId) {
            inputCustomModel.value = result.customModelId;
          }
        }
      }

      // Multiple Chats Integration
      if (result.chats && result.chats.length > 0) {
        chats = result.chats;
      } else if (result.chatHistory && result.chatHistory.length > 0) {
        const firstUser = result.chatHistory.find(m => m.role === 'user');
        let initialTitle = "Migrated Chat";
        if (firstUser && firstUser.parts && firstUser.parts[0] && firstUser.parts[0].text) {
          initialTitle = firstUser.parts[0].text.substring(0, 25);
        }
        const migrated = {
          id: "chat-migrated",
          title: initialTitle || "Migrated Chat",
          history: result.chatHistory
        };
        chats = [migrated];
      } else {
        chats = [];
      }

      // Every time the extension opens, ensure the active chat is a brand-new empty chat.
      // If the most recent chat in the history is already completely empty, we can reuse it.
      // Otherwise, we create and prepend a brand new empty chat.
      const hasEmptyMostRecent = chats.length > 0 && (!chats[0].history || chats[0].history.length === 0);
      if (hasEmptyMostRecent) {
        activeChatId = chats[0].id;
      } else {
        const initial = {
          id: "chat-" + Date.now(),
          title: "New Chat",
          history: []
        };
        chats.unshift(initial);
        activeChatId = initial.id;
      }
      chrome.storage.local.set({ chats: chats, activeChatId: activeChatId });

      const activeChat = chats.find(c => c.id === activeChatId) || chats[0];
      if (activeChat) {
        activeChatId = activeChat.id;
        chatHistory = activeChat.history || [];
      }

      renderChatsList();

      if (chatHistory.length > 0) {
        welcomeScreen.style.display = "none";
        renderHistory();
      } else {
        welcomeScreen.style.display = "flex";
      }
    });
  } else {
    console.log("Not running inside Chrome Extension context. Storage simulation active.");
    // Simulated load
    const initial = {
      id: "sim-chat-1",
      title: "New Chat",
      history: []
    };
    chats = [initial];
    activeChatId = initial.id;
    chatHistory = [];
    renderChatsList();
  }

  // Auto-resize prompt text area
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = (promptInput.scrollHeight) + "px";
  });

  // Toggle settings pane visibility
  btnSettings.addEventListener("click", () => {
    settingsPane.classList.toggle("collapsed");
    chatsPane.classList.add("collapsed"); // Close chats pane if open
  });

  // Toggle chats pane visibility
  btnChats.addEventListener("click", () => {
    chatsPane.classList.toggle("collapsed");
    settingsPane.classList.add("collapsed"); // Close settings pane if open
  });

  // Create new chat
  btnNewChat.addEventListener("click", () => {
    const newChat = {
      id: "chat-" + Date.now(),
      title: "New Chat",
      history: []
    };
    chats.unshift(newChat);
    activeChatId = newChat.id;
    chatHistory = [];

    chatsPane.classList.add("collapsed");
    chatLog.innerHTML = "";
    welcomeScreen.style.display = "flex";

    saveChatsToStorage();
    showToast("New chat created!");
  });

  function saveChatsToStorage() {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat) {
      // Clean and sanitize the history to remove any massive base64 image strings
      // This protects chrome.storage.local from hitting the quota limit and keeps startup load times instant.
      const sanitizedHistory = chatHistory.map(msg => {
        const cleanParts = msg.parts.map(part => {
          if (part.inlineData && part.inlineData.data && part.inlineData.data.length > 1000) {
            return {
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: "OMITTED_TO_PREVENT_STORAGE_BLOAT"
              }
            };
          }
          return part;
        });
        return {
          role: msg.role,
          parts: cleanParts
        };
      });

      // Synchronize back to the current session variable to avoid memory leaks/accumulated latency
      chatHistory = sanitizedHistory;
      activeChat.history = sanitizedHistory;

      if (activeChat.title === "New Chat" && chatHistory.length > 0) {
        const firstUser = chatHistory.find(m => m.role === 'user');
        if (firstUser && firstUser.parts && firstUser.parts[0] && firstUser.parts[0].text) {
          let text = firstUser.parts[0].text.trim();
          if (text.includes("DOM innerText Context")) {
            const index = text.indexOf("User Prompt:");
            if (index !== -1) {
              text = text.substring(index + 12).trim();
            }
          }
          activeChat.title = text.substring(0, 25) || "New Chat";
        }
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ chats: chats, activeChatId: activeChatId });
    }
    renderChatsList();
  }

  function renderChatsList() {
    chatsList.innerHTML = "";
    chats.forEach(chat => {
      const item = document.createElement("div");
      item.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;

      const info = document.createElement("div");
      info.className = "chat-item-info";

      const icon = document.createElement("span");
      icon.className = "chat-item-icon";
      icon.textContent = "💬";

      const title = document.createElement("span");
      title.className = "chat-item-title";
      title.textContent = chat.title || "New Chat";

      info.appendChild(icon);
      info.appendChild(title);
      item.appendChild(info);

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "chat-item-delete";
      deleteBtn.textContent = "🗑️";
      deleteBtn.title = "Delete Chat";

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (chats.length <= 1) {
          showToast("Cannot delete the last chat session!");
          return;
        }

        chats = chats.filter(c => c.id !== chat.id);
        if (activeChatId === chat.id) {
          activeChatId = chats[0].id;
          chatHistory = chats[0].history || [];
          chatLog.innerHTML = "";
          if (chatHistory.length > 0) {
            welcomeScreen.style.display = "none";
            renderHistory();
          } else {
            welcomeScreen.style.display = "flex";
          }
        }
        saveChatsToStorage();
      });

      item.appendChild(deleteBtn);

      // Click to load chat
      item.addEventListener("click", () => {
        if (activeChatId === chat.id) return;
        activeChatId = chat.id;
        chatHistory = chat.history || [];

        chatsPane.classList.add("collapsed");
        chatLog.innerHTML = "";
        if (chatHistory.length > 0) {
          welcomeScreen.style.display = "none";
          renderHistory();
        } else {
          welcomeScreen.style.display = "flex";
        }
        saveChatsToStorage();
      });

      chatsList.appendChild(item);
    });
  }

  // Toggle API Key visibility
  btnToggleKeyVisibility.addEventListener("click", () => {
    if (inputApiKey.type === "password") {
      inputApiKey.type = "text";
      btnToggleKeyVisibility.textContent = "Hide";
    } else {
      inputApiKey.type = "password";
      btnToggleKeyVisibility.textContent = "Show";
    }
  });

  // Toggle OpenAI API Key visibility
  btnToggleOpenaiKeyVisibility.addEventListener("click", () => {
    if (inputOpenaiApiKey.type === "password") {
      inputOpenaiApiKey.type = "text";
      btnToggleOpenaiKeyVisibility.textContent = "Hide";
    } else {
      inputOpenaiApiKey.type = "password";
      btnToggleOpenaiKeyVisibility.textContent = "Show";
    }
  });

  // Toggle Settings Groups depending on Provider
  selectProvider.addEventListener("change", () => {
    if (selectProvider.value === "gemini") {
      geminiSettingsGroup.style.display = "block";
      openaiSettingsGroup.style.display = "none";
    } else {
      geminiSettingsGroup.style.display = "none";
      openaiSettingsGroup.style.display = "block";
    }
  });

  // Model selection listener
  selectModel.addEventListener("change", () => {
    if (selectModel.value === "custom") {
      customModelGroup.style.display = "block";
    } else {
      customModelGroup.style.display = "none";
    }
  });

  // OpenAI Model scanner
  const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  function makeSilentWavBase64(durationSec, sampleRate) {
    const numSamples = Math.floor(durationSec * sampleRate);
    const dataSize = numSamples * 2; // 16-bit mono
    const buf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buf);
    function writeStr(offset, str) { for(let i=0;i<str.length;i++) view.setUint8(offset+i, str.charCodeAt(i)); }
    writeStr(0,'RIFF'); view.setUint32(4, 36+dataSize, true); writeStr(8,'WAVE');
    writeStr(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
    view.setUint16(22,1,true); view.setUint32(24,sampleRate,true);
    view.setUint32(28, sampleRate*2, true); view.setUint16(32,2,true); view.setUint16(34,16,true);
    writeStr(36,'data'); view.setUint32(40,dataSize,true);
    let binary = '';
    const bytes = new Uint8Array(buf);
    for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  const TINY_WAV_B64 = makeSilentWavBase64(0.2, 8000);

  function heuristicGuess(name) {
    const n = (name||'').toLowerCase();
    const visionPattern = /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|o1|o3|o4|gemini|claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku|llava|-vl\b|vision|pixtral|qwen.*vl|internvl|phi-3.*vision|phi-3\.5-vision|llama-3\.2.*vision|llama-4|molmo/;
    const audioPattern = /gpt-4o-audio|realtime|audio-preview|qwen.*audio|omni/;
    return { vision: visionPattern.test(n), audio: audioPattern.test(n) };
  }

  btnScanOpenai.addEventListener("click", async () => {
    const endpoint = inputOpenaiBaseUrl.value.trim();
    const key = inputOpenaiApiKey.value.trim();
    const model = inputOpenaiModelId.value.trim();

    if (!endpoint || !key || !model) {
      openaiScanResults.textContent = "Error: Please enter Base URL, API Key, and Model ID first.";
      openaiScanResults.style.color = "#f2665e";
      return;
    }

    btnScanOpenai.disabled = true;
    btnScanOpenai.textContent = "Scanning...";
    openaiScanResults.textContent = "Scanning connection and capabilities...";
    openaiScanResults.style.color = "#f2b84b";

    async function rawCall(messages) {
      let ep = endpoint.replace(/\/+$/,'');
      const url = ep.includes('/chat/completions') ? ep : ep + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 5
        })
      });
      let json = null;
      try { json = await response.json(); } catch(e){}
      return { ok: response.ok, status: response.status, json };
    }

    function getErrText(res) {
      if (res && res.json && res.json.error) {
        return res.json.error.message || JSON.stringify(res.json.error);
      }
      if (res && res.json) return JSON.stringify(res.json).slice(0, 150);
      return 'Status ' + (res ? res.status : '?');
    }

    try {
      // 1. Text check
      const textRes = await rawCall([{ role: 'user', content: 'Reply with just: OK' }]);
      if (!textRes.ok) {
        openaiScanResults.textContent = `Text failed (${textRes.status}): ` + getErrText(textRes);
        openaiScanResults.style.color = "#f2665e";
        btnScanOpenai.disabled = false;
        btnScanOpenai.textContent = "🔍 Scan Model Capabilities";
        return;
      }

      let detectedVision = false;
      let detectedAudio = false;
      const guess = heuristicGuess(model);

      // 2. Vision probe
      try {
        const visRes = await rawCall([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Reply with just: OK' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + TINY_PNG_B64 } }
            ]
          }
        ]);
        if (visRes.ok) {
          detectedVision = true;
        } else {
          const errMsg = getErrText(visRes).toLowerCase();
          if (!errMsg.includes('image') && !errMsg.includes('vision') && !errMsg.includes('multimodal') && !errMsg.includes('unsupported')) {
            detectedVision = guess.vision;
          }
        }
      } catch (e) {
        detectedVision = guess.vision;
      }

      // 3. Audio probe
      try {
        const audRes = await rawCall([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Reply with just: OK' },
              { type: 'input_audio', input_audio: { data: TINY_WAV_B64, format: 'wav' } }
            ]
          }
        ]);
        if (audRes.ok) {
          detectedAudio = true;
        } else {
          const errMsg = getErrText(audRes).toLowerCase();
          if (!errMsg.includes('audio') && !errMsg.includes('multimodal') && !errMsg.includes('unsupported')) {
            detectedAudio = guess.audio;
          }
        }
      } catch (e) {
        detectedAudio = guess.audio;
      }

      openaiCapabilities = { vision: detectedVision, audio: detectedAudio };
      openaiScanResults.innerHTML = `Capabilities Verified:<br>• Text: Confirmed<br>• Vision: ${detectedVision ? "✅ Confirmed" : "❌ Not supported"}<br>• Audio: ${detectedAudio ? "✅ Confirmed" : "❌ Not supported"}`;
      openaiScanResults.style.color = "#6ee7a8";
    } catch (err) {
      openaiScanResults.textContent = "Error scanning: " + err.message;
      openaiScanResults.style.color = "#f2665e";
    }

    btnScanOpenai.disabled = false;
    btnScanOpenai.textContent = "🔍 Scan Model Capabilities";
  });

  // Save Settings Clicked
  btnSaveSettings.addEventListener("click", () => {
    apiProvider = selectProvider.value;
    apiKey = inputApiKey.value.trim();
    let selectedVal = selectModel.value;
    
    if (selectedVal === "custom") {
      modelId = inputCustomModel.value.trim() || "gemini-2.5-flash";
    } else {
      modelId = selectedVal;
    }

    openaiBaseUrl = inputOpenaiBaseUrl.value.trim() || "https://api.openai.com/v1";
    openaiApiKey = inputOpenaiApiKey.value.trim();
    openaiModelId = inputOpenaiModelId.value.trim() || "gpt-4o-mini";

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        apiProvider: apiProvider,
        apiKey: apiKey,
        modelId: selectedVal,
        customModelId: inputCustomModel.value.trim(),
        openaiBaseUrl: openaiBaseUrl,
        openaiApiKey: openaiApiKey,
        openaiModelId: openaiModelId,
        openaiCapabilities: openaiCapabilities
      }, () => {
        settingsPane.classList.add("collapsed");
        const activeKey = apiProvider === "gemini" ? apiKey : openaiApiKey;
        if (activeKey) {
          welcomeKeyWarning.style.display = "none";
        } else {
          welcomeKeyWarning.style.display = "block";
          welcomeKeyWarning.textContent = apiProvider === "gemini" ? "⚠️ Please click the gear icon (⚙️) above to configure your Gemini API Key." : "⚠️ Please click the gear icon (⚙️) above to configure your OpenAI-Compatible API Key.";
        }
        showToast("Settings saved successfully!");
      });
    } else {
      showToast("Storage simulated. Key saved.");
    }
  });

  // Trigger suggestions
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      promptInput.value = btn.getAttribute("data-prompt");
      promptInput.dispatchEvent(new Event("input"));
      promptInput.focus();
    });
  });

  // Plus menu toggle
  btnPlus.addEventListener("click", (e) => {
    e.stopPropagation();
    plusMenu.classList.toggle("hidden");
  });

  // Close plus menu when clicking elsewhere
  document.addEventListener("click", () => {
    plusMenu.classList.add("hidden");
  });

  // Quick Tools Bar Chips Listener
  document.querySelectorAll(".tool-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-tool-action");
      if (action === "extract-tables") {
        promptInput.value = "Extract all tabular and grid data on this page into structured CSV and JSON format.";
        promptInput.dispatchEvent(new Event("input"));
        btnSend.click();
      } else if (action === "highlight-cta") {
        promptInput.value = "Identify and visually highlight the main call-to-action buttons, interactive links, and input forms on this page with glowing violet borders.";
        promptInput.dispatchEvent(new Event("input"));
        btnSend.click();
      } else if (action === "search-tabs") {
        promptInput.value = "Search across all my open browser tabs and summarize what pages are currently active.";
        promptInput.dispatchEvent(new Event("input"));
        btnSend.click();
      } else if (action === "capture-tab") {
        menuCapturePage.click();
      }
    });
  });

  // Extra Plus Menu Items
  const menuExtractTables = document.getElementById("menu-extract-tables");
  const menuHighlightElements = document.getElementById("menu-highlight-elements");
  const menuSearchTabs = document.getElementById("menu-search-tabs");
  const btnExportChats = document.getElementById("btn-export-chats");

  if (menuExtractTables) {
    menuExtractTables.addEventListener("click", () => {
      plusMenu.classList.add("hidden");
      promptInput.value = "Extract all tables on this page to structured CSV.";
      promptInput.dispatchEvent(new Event("input"));
      btnSend.click();
    });
  }

  if (menuHighlightElements) {
    menuHighlightElements.addEventListener("click", () => {
      plusMenu.classList.add("hidden");
      promptInput.value = "Highlight the most important elements, headings, and input areas on this web page.";
      promptInput.dispatchEvent(new Event("input"));
      btnSend.click();
    });
  }

  if (menuSearchTabs) {
    menuSearchTabs.addEventListener("click", () => {
      plusMenu.classList.add("hidden");
      promptInput.value = "List and search all open browser tabs.";
      promptInput.dispatchEvent(new Event("input"));
      btnSend.click();
    });
  }

  if (btnExportChats) {
    btnExportChats.addEventListener("click", () => {
      if (!chatHistory || chatHistory.length === 0) {
        showToast("No chat messages to export yet.");
        return;
      }
      let mdContent = `# AcceleratedLogic AI Chat Export\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
      chatHistory.forEach(msg => {
        const roleName = msg.role === "user" ? "👤 User" : "⚡ AcceleratedLogic AI";
        const textParts = msg.parts ? msg.parts.map(p => p.text || "").join("\n") : "";
        mdContent += `### ${roleName}\n\n${textParts}\n\n---\n\n`;
      });

      const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-export-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Chat exported as Markdown!");
    });
  }

  // Upload File selected from menu
  menuUploadFile.addEventListener("click", () => {
    hiddenFileInput.click();
  });

  hiddenFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result;
      setAttachment({
        name: file.name,
        size: formatSize(file.size),
        mimeType: file.type,
        base64: base64String
      });
    };
    reader.readAsDataURL(file);
  });

  // Close tab picker modal
  closeTabPicker.addEventListener("click", () => {
    tabPickerModal.classList.add("hidden");
  });

  // Clicking outside modal content to close it
  tabPickerModal.addEventListener("click", (e) => {
    if (e.target === tabPickerModal) {
      tabPickerModal.classList.add("hidden");
    }
  });

  // Utility to escape HTML strings
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // The actual capture tab function
  function captureTab(selectedTab) {
    // 1. Activate the tab if it is not currently active
    chrome.tabs.update(selectedTab.id, { active: true }, () => {
      // 2. Introduce a small delay to make sure the tab is fully rendered/active
      setTimeout(() => {
        // 3. Inject script to read DOM content of the selected tab
        chrome.scripting.executeScript({
          target: { tabId: selectedTab.id },
          func: () => {
            return {
              title: document.title,
              url: window.location.href,
              text: document.body ? document.body.innerText.substring(0, 50000) : ""
            };
          }
        }, (results) => {
          let extractedDom = {
            title: selectedTab.title,
            url: selectedTab.url,
            text: ""
          };

          if (results && results[0] && results[0].result) {
            extractedDom = results[0].result;
          }

          const isVision = apiProvider === "gemini" || (apiProvider === "openai-compatible" && !!openaiCapabilities?.vision);
          if (isVision) {
            // 4. Capture visible screenshot
            chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (screenshotUrl) => {
              if (!screenshotUrl) {
                // If capturing fails due to restricted page (e.g. chrome:// tabs)
                showToast("Failed to capture screen (restricted tab). Using DOM context only.");
                screenshotUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
              }

              setAttachment({
                name: `Capture: ${extractedDom.title}`,
                size: "Webpage + DOM context",
                mimeType: "image/jpeg",
                base64: screenshotUrl,
                domContext: extractedDom
              });
              
              // Auto-fill prompt if empty
              if (!promptInput.value.trim()) {
                promptInput.value = "Explain or analyze this page for me.";
                promptInput.dispatchEvent(new Event("input"));
              }
            });
          } else {
            // ONLY DOM, NO SCREENSHOT
            setAttachment({
              name: `Capture: ${extractedDom.title}`,
              size: "Webpage DOM Context",
              mimeType: null,
              base64: null,
              domContext: extractedDom
            });
            if (!promptInput.value.trim()) {
              promptInput.value = "Explain or analyze this page for me.";
              promptInput.dispatchEvent(new Event("input"));
            }
          }
        });
      }, 250);
    });
  }

  // Capture Page Screenshot + DOM (with tab selection)
  menuCapturePage.addEventListener("click", () => {
    // Hide plus menu
    plusMenu.classList.add("hidden");

    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      showToast("Screenshot capture only works inside real chrome browser!");
      return;
    }

    // Query all tabs in the current window
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        showToast("No tabs found to capture.");
        return;
      }

      // Render tab selection list
      pickerTabList.innerHTML = "";
      
      tabs.forEach((tab) => {
        const tabItem = document.createElement("button");
        tabItem.className = "tab-picker-item";
        
        const favIcon = tab.favIconUrl || "🌐";
        const iconHtml = (typeof favIcon === "string" && favIcon.startsWith("http")) 
          ? `<img src="${favIcon}" style="width: 16px; height: 16px; object-fit: contain;" referrerPolicy="no-referrer" />` 
          : `<span class="tab-picker-icon">${favIcon}</span>`;

        tabItem.innerHTML = `
          <div class="tab-picker-icon">${iconHtml}</div>
          <div class="tab-picker-info">
            <span class="tab-picker-title">${escapeHtml(tab.title || "Untitled Tab")}</span>
            <span class="tab-picker-url">${escapeHtml(tab.url || "")}</span>
          </div>
        `;

        tabItem.addEventListener("click", () => {
          // Hide modal
          tabPickerModal.classList.add("hidden");
          
          // Perform capture of the selected tab!
          captureTab(tab);
        });

        pickerTabList.appendChild(tabItem);
      });

      // Show the modal
      tabPickerModal.classList.remove("hidden");
    });
  });

  // Set active attachment state and display preview
  function setAttachment(attachmentObj) {
    activeAttachment = attachmentObj;
    attachmentNameElement.textContent = attachmentObj.name;
    attachmentSizeElement.textContent = attachmentObj.size;
    
    if (attachmentObj.mimeType && attachmentObj.mimeType.startsWith("image/")) {
      attachmentTypeIcon.textContent = "🖼️";
    } else if (attachmentObj.mimeType && attachmentObj.mimeType.includes("pdf")) {
      attachmentTypeIcon.textContent = "📕";
    } else {
      attachmentTypeIcon.textContent = "📄";
    }

    attachmentPreview.classList.remove("hidden");
  }

  // Remove attachment click
  btnRemoveAttachment.addEventListener("click", () => {
    activeAttachment = null;
    attachmentPreview.classList.add("hidden");
    hiddenFileInput.value = "";
  });

  // Send Prompt
  btnSend.addEventListener("click", sendMessage);
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function setStopState(active) {
    if (active) {
      isGenerating = true;
      btnSend.classList.add("stop-state");
      btnSend.title = "Stop generation";
      btnSend.innerHTML = `
        <svg viewBox="0 0 24 24" class="send-icon">
          <rect x="6" y="6" width="12" height="12" rx="1.5" fill="#ffffff" />
        </svg>
      `;
    } else {
      isGenerating = false;
      currentAbortController = null;
      btnSend.classList.remove("stop-state");
      btnSend.title = "Send message";
      btnSend.innerHTML = `
        <svg viewBox="0 0 24 24" class="send-icon">
          <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
        </svg>
      `;
    }
  }

  function isThinkingContext(text, inThinkingBlock) {
    if (inThinkingBlock) return true;
    if (!text) return false;
    
    // Check standard <thinking> tags
    const lastStart = text.lastIndexOf("<thinking>");
    if (lastStart !== -1) {
      const lastEnd = text.lastIndexOf("</thinking>");
      if (lastEnd < lastStart) return true;
    }

    // Check raw thoughts / reasoning prefix heuristics
    const trimmed = text.trim();
    if (/^\s*(Thought|thought|Thinking|thinking)\s*(:\s*|\n+\s*)/i.test(trimmed)) {
      const match = trimmed.match(/^\s*(Thought|thought|Thinking|thinking)\s*(:\s*|\n+\s*)/i);
      const rest = trimmed.substring(match[0].length);
      const transitionRegex = /\n\n(?=[a-zA-Z]|\*\*|#|-|\*|\[)/;
      if (!transitionRegex.test(rest)) {
        return true;
      }
    }

    return false;
  }

  async function sendMessage() {
    if (isGenerating) {
      if (currentAbortController) {
        currentAbortController.abort();
      }
      return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt && !activeAttachment) return;

    const activeKey = apiProvider === "gemini" ? apiKey : openaiApiKey;
    if (!activeKey) {
      showToast(apiProvider === "gemini" ? "Please enter your Gemini API Key in Settings first!" : "Please enter your OpenAI-Compatible API Key in Settings first!");
      settingsPane.classList.remove("collapsed");
      return;
    }

    // Hide welcome screen
    welcomeScreen.style.display = "none";

    // 1. Prepare visual components of the message
    const userMessageContainer = document.createElement("div");
    userMessageContainer.className = "message-bubble user";
    
    const msgHeader = document.createElement("div");
    msgHeader.className = "message-header";
    msgHeader.innerHTML = `<span>You</span><span>${getCurrentTime()}</span>`;
    userMessageContainer.appendChild(msgHeader);

    // If attachment exists, render the thumbnail/details in bubble
    let savedAttachmentForMessage = null;
    if (activeAttachment) {
      savedAttachmentForMessage = { ...activeAttachment };
      const attachDiv = document.createElement("div");
      attachDiv.className = "bubble-attachment";
      
      if (savedAttachmentForMessage.mimeType.startsWith("image/")) {
        const thumb = document.createElement("img");
        thumb.className = "bubble-attachment-thumbnail";
        thumb.src = savedAttachmentForMessage.base64;
        attachDiv.appendChild(thumb);
      } else {
        const thumbIcon = document.createElement("span");
        thumbIcon.textContent = savedAttachmentForMessage.mimeType.includes("pdf") ? "📕" : "📄";
        thumbIcon.style.fontSize = "1.1rem";
        attachDiv.appendChild(thumbIcon);
      }

      const desc = document.createElement("span");
      desc.textContent = savedAttachmentForMessage.name;
      desc.style.whiteSpace = "nowrap";
      desc.style.overflow = "hidden";
      desc.style.textOverflow = "ellipsis";
      attachDiv.appendChild(desc);

      userMessageContainer.appendChild(attachDiv);
    }

    // Prompt content
    const msgBody = document.createElement("div");
    msgBody.className = "bubble-text";
    msgBody.textContent = prompt || "[Sent context attachment]";
    userMessageContainer.appendChild(msgBody);

    chatLog.appendChild(userMessageContainer);
    scrollToBottom();

    // Reset input boxes
    promptInput.value = "";
    promptInput.style.height = "auto";
    const currentAttachment = activeAttachment;
    activeAttachment = null;
    attachmentPreview.classList.add("hidden");
    hiddenFileInput.value = "";

    // 2. Add message to chat history
    let userParts = [];
    let finalPrompt = prompt;

    if (currentAttachment) {
      // If it contains a DOM extraction, append to query
      if (currentAttachment.domContext) {
        finalPrompt = `[Webpage Context: Title: "${currentAttachment.domContext.title}", URL: ${currentAttachment.domContext.url}]\n\nDOM innerText Context (Extract):\n---\n${currentAttachment.domContext.text}\n---\n\nUser Prompt: ${prompt || "Analyze this page"}`;
      }

      // Format inline attachment data
      const base64Data = currentAttachment.base64.split(",")[1];
      userParts.push({
        inlineData: {
          mimeType: currentAttachment.mimeType,
          data: base64Data
        }
      });
    }

    userParts.push({ text: finalPrompt || "Analyze this attachment" });
    
    // Add to history
    chatHistory.push({
      role: "user",
      parts: userParts
    });

    // 3. Create Assistant bubble with loading spinner
    const assistantBubble = document.createElement("div");
    assistantBubble.className = "message-bubble assistant";

    const assistHeader = document.createElement("div");
    assistHeader.className = "message-header";
    assistHeader.innerHTML = `<span>AcceleratedLogic</span><span>${getCurrentTime()}</span>`;
    assistantBubble.appendChild(assistHeader);

    const loaderDiv = document.createElement("div");
    loaderDiv.className = "loading-indicator";
    loaderDiv.innerHTML = '<div class="spinner"></div> <span>AcceleratedLogic is thinking...</span>';
    assistantBubble.appendChild(loaderDiv);

    chatLog.appendChild(assistantBubble);
    scrollToBottom();

    try {
      setStopState(true);
      currentAbortController = new AbortController();

      // Determine correct model name
      let activeModel = modelId;
      if (activeModel === "custom") {
        activeModel = inputCustomModel.value.trim() || "gemini-2.5-flash";
      }

      // We run an autonomous multi-step agent loop to allow chaining sequential tool executions (up to MAX_AGENT_STEPS turns)
      let hasMoreTurns = true;
      let currentAssistantBubble = assistantBubble;
      let currentLoaderDiv = loaderDiv;
      const MAX_AGENT_STEPS = 30;
      let currentStepCount = 0;

      while (hasMoreTurns && currentStepCount < MAX_AGENT_STEPS) {
        currentStepCount++;
        if (currentAbortController && currentAbortController.signal.aborted) {
          throw new DOMException("Generation stopped by user.", "AbortError");
        }
        hasMoreTurns = false;
        let activeFunctionCall = null;

        let response;
        let reader;
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let rawModelParts = [];
        let buffer = "";
        let inThinkingBlock = false;

        const isVisionCapable = apiProvider === "gemini" || !!openaiCapabilities?.vision;
        const systemInstructionText = `You are AcceleratedLogic, an advanced browser assistant Chrome Extension.
You help users analyze web pages, answer questions, extract data, automate tasks, and perform deep research.
You can call 'get_page_dom' to get webpage text${isVisionCapable ? ", 'get_page_screenshot' to get a visual screenshot" : ""}, 'click_element' to interact with buttons/links, 'click_at_coordinate' to click at custom screen coordinates and optionally type, 'type_text' to fill out input fields, 'fill_form' to batch-fill multiple form fields, textareas, and checkboxes in one atomic action, 'execute_custom_script' to run custom JavaScript snippets in the webpage context, 'wait_for_condition' to poll and wait for dynamic elements or text to load, 'crawl_links' to discover and follow hyperlinks across pages, 'get_page_meta_seo' to extract structured JSON-LD schemas and SEO metadata, 'update_plan' to maintain a multi-phase long-horizon execution plan, 'manage_scratchpad' to store and retrieve working memory across research phases, 'scroll_page' to scroll up/down/left/right, 'highlight_element' to visually draw animated glowing bounding boxes and labels around elements, 'extract_table_data' to convert web tables directly into clean JSON, CSV, or Markdown, 'extract_media' to scrape all images, videos, audio, and downloadable files, 'compare_tabs' to compare content between two open browser tabs, 'tts_speak' to read summaries aloud via voice synthesis, 'download_markdown_report' to export research files, 'open_tab' to open a new tab with a specific URL, 'search_web' to perform search queries, 'list_tabs' to list open tabs, 'search_tabs' to search open tabs by query, 'switch_tab' to switch between tabs, 'close_tab' to close a tab, 'press_key' to simulate pressing keys on the webpage, 'select_text' to select/highlight text, and 'replace_text' to replace text.

LONG-HORIZON AUTONOMOUS AGENT LOOP:
You are an autonomous agent capable of chaining up to 30 sequential tool turns to complete complex, multi-phase goals.
- For deep research or complex automation, use 'update_plan' at the beginning to declare your milestones and track progress as you complete each phase.
- Use 'manage_scratchpad' to save critical facts, URLs, and intermediate table data across turns so you don't lose context.
- Use 'wait_for_condition' when waiting for dynamic SPAs, animations, or async search results to render.
- Use 'execute_custom_script' whenever standard tools require deeper programmatic inspection of the DOM.
- Use 'crawl_links' to systematically inspect linked documentation, sub-pages, or product listings.
- After each tool output is returned to you, evaluate the results against your plan, decide your next action, and execute the next tool immediately until the final goal is met.

CRITICAL RULES:
- NATIVE TOOL CALLING: You MUST invoke tools strictly using native function declarations. NEVER output tool calls as raw text, pseudo-code strings, or text fragments like 'call:default_api:...', 'call:get_page_dom', or 'get_page_dom{}'.
- THINKING AND TOOLS SEPARATION: Your internal thinking/reasoning (<thinking>...</thinking>) is strictly for internal reflection. NEVER attempt to call tools, invoke function declarations, or output function call requests inside thinking/reasoning blocks. Tool calls MUST ONLY be executed after thinking completes, outside of <thinking> tags.
- Always output your internal step-by-step planning and thinking process enclosed exactly within <thinking> and </thinking> tags at the very start of your response.
- Never output raw base64 data, gibberish strings, or repeating binary characters.
- PAGE ANALYSIS RULE: When you open a page or perform a search, you MUST NOT just report that the page/search is opened. You MUST immediately proceed to call 'get_page_dom' (or 'get_page_screenshot') to read, analyze, and comprehend its actual content before moving on or concluding, unless the user explicitly said they only wanted to open the page.
- REAL-TIME SEARCH RULE: If you are unsure of any answer, or need to retrieve current/real-time information, you MUST use 'search_web' to search, then open or switch to relevant result tabs and extract their text using 'get_page_dom' to analyze the findings. Never speculate or give generic answers without verifying.
- MULTI-TAB NAVIGATION: You know what each tab is and can switch tabs if needed. Use 'list_tabs' or 'search_tabs' to view open tabs, 'compare_tabs' to contrast two tabs, and 'switch_tab' to change the active tab when gathering information from different pages.
- TABLE DATA EXTRACTION: When user asks for data in tables, pricing grids, statistics, or CSV/JSON conversions, call 'extract_table_data' to automatically parse table structures.
- FORM FILLING: When filling multiple inputs or forms, use 'fill_form' to atomically fill all target fields at once.
- ELEMENT HIGHLIGHTING: When pointing out key features, buttons, fields, or answers on the page, use 'highlight_element' to draw a glowing border and label badge so the user can easily see what you are referring to.
- NON-DOM INTERACTIVE KEYPRESS RULE: If you are interacting with canvas-based elements, browser games, or non-input interactive areas where WASD or other key actions are required to move or interact, use the 'press_key' tool to send raw keyboard presses directly.
- VERIFICATION RULE: After executing an interactive action that modifies page state (such as 'fill_form', 'type_text', 'replace_text', 'press_key', 'click_element', or 'click_at_coordinate'), you MUST explicitly verify that your action completed correctly by calling 'get_page_dom' or 'get_page_screenshot' immediately after the action.
${isVisionCapable ? "- If you call 'get_page_screenshot', you will receive the screenshot image as inlineData in the next user turn. Analyze the screenshot visually and describe it naturally.\n" : ""}- Keep explanations conversational, elegant, and markdown-formatted.`;

        if (apiProvider === "openai-compatible") {
          let ep = openaiBaseUrl.replace(/\/+$/,'');
          const url = ep.includes('/chat/completions') ? ep : ep + '/chat/completions';
          
          // Map chatHistory to OpenAI format
          const formattedMessages = [];
          
          formattedMessages.push({
            role: "system",
            content: systemInstructionText
          });

          chatHistory.forEach((msg, idx) => {
            const isPastTurn = idx < chatHistory.length - 1;
            const role = msg.role === 'model' ? 'assistant' : 'user';
            
            let textContent = "";
            let base64Images = [];
            
            msg.parts.forEach(part => {
              if (part.text) {
                textContent += part.text;
              } else if (part.inlineData) {
                if (!isPastTurn && openaiCapabilities.vision) {
                  base64Images.push(part.inlineData);
                } else if (isPastTurn) {
                  textContent += ` [Attachment (${part.inlineData.mimeType}) analyzed in previous turn] `;
                }
              }
              if (part.functionCall) {
                textContent += `\n[Requested tool execution: ${part.functionCall.name} with arguments: ${JSON.stringify(part.functionCall.args)}]`;
              }
            });

            if (base64Images.length > 0) {
              const contentArray = [{ type: "text", text: textContent || "Analyze this page screenshot." }];
              base64Images.forEach(img => {
                contentArray.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${img.mimeType};base64,${img.data}`
                  }
                });
              });
              formattedMessages.push({
                role: role,
                content: contentArray
              });
            } else {
              formattedMessages.push({
                role: role,
                content: textContent || "Analyze"
              });
            }
          });

          // Declare OpenAI tools
          const openAITools = [
            {
              type: "function",
              function: {
                name: "get_page_dom",
                description: "Retrieves the webpage text context, title, and URL of the active browser tab to answer user context questions.",
                parameters: { type: "object", properties: {} }
              }
            },
            ...(isVisionCapable ? [{
              type: "function",
              function: {
                name: "get_page_screenshot",
                description: "Captures a visual screenshot of the current visible tab's viewport as base64 JPEG image data.",
                parameters: { type: "object", properties: {} }
              }
            }] : []),
            {
              type: "function",
              function: {
                name: "click_element",
                description: "Clicks an element on the webpage of the active browser tab by its CSS selector or text context.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: {
                      type: "string",
                      description: "CSS selector of the element to click (e.g. 'button', '#submit', '.btn-login', 'a')."
                    },
                    textContext: {
                      type: "string",
                      description: "Optional case-insensitive text inside the element to click (e.g. 'Submit', 'Log In', 'Sign Up')."
                    }
                  },
                  required: ["selector"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "click_at_coordinate",
                description: "Clicks at a specific coordinate (pixel or percentage) on the active tab's screen to select elements, focus rich-text areas, or click canvas-based elements, and optionally types text.",
                parameters: {
                  type: "object",
                  properties: {
                    x: { type: "number", description: "X-coordinate (0 to 100 for percentage, or pixel coordinate)." },
                    y: { type: "number", description: "Y-coordinate (0 to 100 for percentage, or pixel coordinate)." },
                    coordinateType: { type: "string", enum: ["percentage", "pixels"], description: "Defaults to 'percentage'." },
                    typeText: { type: "string", description: "Optional text to type immediately after clicking." },
                    submitAfter: { type: "boolean", description: "Whether to submit or hit Enter after typing." }
                  },
                  required: ["x", "y"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "type_text",
                description: "Types text into an input, textarea, contenteditable div or rich-text editor on the webpage of the active browser tab.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "CSS selector of the input/textarea/editor to type into." },
                    text: { type: "string", description: "The text string to type into the element." },
                    submitAfter: { type: "boolean", description: "Whether to submit or hit Enter after typing." }
                  },
                  required: ["selector", "text"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "scroll_page",
                description: "Scrolls the webpage in a given direction by a specified pixel amount or percentage.",
                parameters: {
                  type: "object",
                  properties: {
                    direction: { type: "string", enum: ["up", "down", "left", "right"], description: "The direction to scroll." },
                    amount: { type: "number", description: "Optional pixel amount to scroll." }
                  },
                  required: ["direction"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "wait",
                description: "Waits/sleeps for a specified duration of milliseconds before proceeding. Use this when waiting for pages to load, search results to refresh, or animations to finish.",
                parameters: {
                  type: "object",
                  properties: {
                    delayMs: { type: "number", description: "The wait duration in milliseconds (e.g. 2000 for 2 seconds)." }
                  },
                  required: ["delayMs"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "open_tab",
                description: "Opens a new browser tab with the specified URL.",
                parameters: {
                  type: "object",
                  properties: {
                    url: { type: "string", description: "The complete URL to open." }
                  },
                  required: ["url"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "search_web",
                description: "Performs a web search for the specified query and navigates to the search results.",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "The search query string." }
                  },
                  required: ["query"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "list_tabs",
                description: "Lists all currently open tabs in the browser, showing their unique IDs, titles, URLs, and active status.",
                parameters: {
                  type: "object",
                  properties: {}
                }
              }
            },
            {
              type: "function",
              function: {
                name: "switch_tab",
                description: "Switches the active tab to the one with the specified tab ID.",
                parameters: {
                  type: "object",
                  properties: {
                    tabId: { type: "number", description: "The unique integer ID of the tab to switch to." }
                  },
                  required: ["tabId"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "press_key",
                description: "Simulates pressing a key (like WASD keys for movement/games, or Enter/Space/Escape) on the webpage.",
                parameters: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "The key to press (e.g. 'w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape')." },
                    selector: { type: "string", description: "Optional CSS selector of the element to focus before pressing. If omitted, targets current focus or body." },
                    holdDuration: { type: "number", description: "Optional duration to hold the key down in milliseconds. Defaults to 50ms." },
                    ctrlKey: { type: "boolean", description: "Optional. Control key held down." },
                    altKey: { type: "boolean", description: "Optional. Alt key held down." },
                    shiftKey: { type: "boolean", description: "Optional. Shift key held down." },
                    metaKey: { type: "boolean", description: "Optional. Meta/Command key held down." }
                  },
                  required: ["key"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "select_text",
                description: "Selects/highlights text in the webpage. For input/textarea, focuses and sets selection range. For rich text editors or standard text, uses selection APIs.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "Optional CSS selector of the element. If omitted, targets body." },
                    searchText: { type: "string", description: "The text string to search for and select/highlight." },
                    startIndex: { type: "number", description: "Optional character start index for input/textarea selection." },
                    endIndex: { type: "number", description: "Optional character end index for input/textarea selection." }
                  },
                  required: ["searchText"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "replace_text",
                description: "Replaces text in the webpage. If searchText is provided, finds and replaces it. If searchText is omitted, replaces the currently selected/highlighted text. Uses standard rich-text editing APIs to preserve document state and history.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "Optional CSS selector of the element. If omitted, targets current focus." },
                    searchText: { type: "string", description: "Optional text string to find and replace. If omitted, replaces active selection." },
                    replaceText: { type: "string", description: "The text to insert/replace with." }
                  },
                  required: ["replaceText"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "extract_links",
                description: "Extracts all hyperlinks (URLs and anchor texts) on the active webpage, with an optional search filter keyword or CSS selector.",
                parameters: {
                  type: "object",
                  properties: {
                    keyword: { type: "string", description: "Optional keyword or search term to filter link URLs or text." },
                    selector: { type: "string", description: "Optional CSS selector to scope link extraction (e.g. 'nav', 'main', '.articles')." }
                  }
                }
              }
            },
            {
              type: "function",
              function: {
                name: "execute_script",
                description: "Evaluates custom JavaScript code inside the active webpage context and returns the evaluation output.",
                parameters: {
                  type: "object",
                  properties: {
                    code: { type: "string", description: "The JavaScript code string to execute (e.g. 'document.title' or 'window.scrollY')." }
                  },
                  required: ["code"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "go_back_forward",
                description: "Navigates browser history back or forward on the active tab.",
                parameters: {
                  type: "object",
                  properties: {
                    direction: { type: "string", enum: ["back", "forward"], description: "The navigation direction ('back' or 'forward')." }
                  },
                  required: ["direction"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "get_element_details",
                description: "Inspects an element by CSS selector or text context to retrieve its dimensions, position, inner HTML, text content, and attributes.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "CSS selector of the element to inspect." },
                    textContext: { type: "string", description: "Optional text context inside the element to match." }
                  },
                  required: ["selector"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "highlight_element",
                description: "Visually highlights an element on the webpage with an animated glowing border, optional badge label, and scrolls it into view for the user.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "CSS selector of the element to highlight." },
                    color: { type: "string", description: "Optional hex or rgba color for the glowing highlight (e.g. '#8b5cf6', '#3b82f6', '#10b981'). Defaults to '#8b5cf6'." },
                    durationMs: { type: "number", description: "Duration in milliseconds to display the highlight (e.g. 4000). Set to 0 to keep until dismiss. Defaults to 4000." },
                    label: { type: "string", description: "Optional text label/badge to display directly above the element." },
                    scrollIntoView: { type: "boolean", description: "Whether to smoothly scroll the highlighted element into view. Defaults to true." }
                  },
                  required: ["selector"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "extract_table_data",
                description: "Extracts tabular data from web tables or grid structures and formats it into structured JSON, CSV, or Markdown.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "Optional CSS selector of the table element (e.g. 'table', '#pricing', '.data-grid'). If omitted, extracts the primary table on page." },
                    format: { type: "string", enum: ["json", "csv", "markdown"], description: "Format of the extracted table data. Defaults to 'json'." },
                    maxRows: { type: "number", description: "Maximum number of data rows to extract. Defaults to 100." }
                  }
                }
              }
            },
            {
              type: "function",
              function: {
                name: "search_tabs",
                description: "Searches open browser tabs by title or URL keyword and returns matching tabs with their IDs.",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "Search query or keyword to match against tab titles and URLs." }
                  },
                  required: ["query"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "close_tab",
                description: "Closes a specific browser tab by its unique tab ID, or the active tab if omitted.",
                parameters: {
                  type: "object",
                  properties: {
                    tabId: { type: "number", description: "Optional tab ID to close. If omitted, closes the active tab." }
                  }
                }
              }
            },
            {
              type: "function",
              function: {
                name: "fill_form",
                description: "Fills multiple input fields, textareas, checkboxes, radio buttons, and select dropdowns across the page in one single atomic operation.",
                parameters: {
                  type: "object",
                  properties: {
                    fields: {
                      type: "array",
                      description: "List of form fields to fill.",
                      items: {
                        type: "object",
                        properties: {
                          selector: { type: "string", description: "Optional CSS selector of the field." },
                          name: { type: "string", description: "Optional name or ID attribute of the form field." },
                          label: { type: "string", description: "Optional label text, placeholder, or aria-label of the input." },
                          value: { type: "string", description: "Value to enter or select. For checkboxes use 'true'/'false'." }
                        },
                        required: ["value"]
                      }
                    },
                    submitAfter: { type: "boolean", description: "Whether to click the form's submit button after filling. Defaults to false." }
                  },
                  required: ["fields"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "extract_media",
                description: "Scrapes and extracts all media on the active webpage including images (URLs, alt text, dimensions), videos, audio, and downloadable files (PDF, zip, docx, etc.).",
                parameters: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["all", "images", "videos", "audio", "documents"], description: "Type of media assets to extract. Defaults to 'all'." },
                    minDimensions: { type: "number", description: "Minimum width/height in px for images to filter out tiny icons. Defaults to 50." }
                  }
                }
              }
            },
            {
              type: "function",
              function: {
                name: "compare_tabs",
                description: "Compares text and metadata between two open browser tabs side-by-side (e.g. comparing products, documentation, or search results).",
                parameters: {
                  type: "object",
                  properties: {
                    tabIdA: { type: "number", description: "First tab ID to compare." },
                    tabIdB: { type: "number", description: "Second tab ID to compare. If omitted, uses the active tab." }
                  },
                  required: ["tabIdA"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "tts_speak",
                description: "Reads text aloud using text-to-speech browser voice synthesis.",
                parameters: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "The text to read aloud." },
                    rate: { type: "number", description: "Speech rate (0.5 to 2.0). Defaults to 1.0." },
                    pitch: { type: "number", description: "Voice pitch (0.5 to 1.5). Defaults to 1.0." }
                  },
                  required: ["text"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "download_markdown_report",
                description: "Generates and triggers a browser download for a structured Markdown report or research summary file.",
                parameters: {
                  type: "object",
                  properties: {
                    filename: { type: "string", description: "File name for the download (e.g. 'research-summary.md')." },
                    markdownContent: { type: "string", description: "The complete Markdown text content to save." }
                  },
                  required: ["filename", "markdownContent"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "update_plan",
                description: "Maintains and tracks a multi-step plan for long-horizon tasks, declaring sub-goals and updating status ('pending', 'in_progress', 'completed', 'failed').",
                parameters: {
                  type: "object",
                  properties: {
                    plan: {
                      type: "array",
                      description: "Array of milestone sub-goals.",
                      items: {
                        type: "object",
                        properties: {
                          step: { type: "number", description: "Step number (1, 2, 3...)" },
                          goal: { type: "string", description: "Description of the milestone goal." },
                          status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"], description: "Current step status." },
                          notes: { type: "string", description: "Optional notes or outcome summary." }
                        },
                        required: ["step", "goal", "status"]
                      }
                    },
                    currentStepIndex: { type: "number", description: "The 1-based index of the currently executing step." }
                  },
                  required: ["plan"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "manage_scratchpad",
                description: "Manages working memory across long-horizon research sessions to store, append, retrieve, or clear intermediate facts, extracted data, and URLs.",
                parameters: {
                  type: "object",
                  properties: {
                    action: { type: "string", enum: ["read", "write", "append", "clear"], description: "Action to perform on scratchpad working memory." },
                    key: { type: "string", description: "Optional key or section name (e.g. 'findings', 'pricing_table', 'sources'). Defaults to 'default'." },
                    content: { type: "string", description: "Content text to write or append." }
                  },
                  required: ["action"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "execute_custom_script",
                description: "Executes a custom JavaScript snippet in the webpage context and returns the JSON result for advanced DOM querying or deep page manipulation.",
                parameters: {
                  type: "object",
                  properties: {
                    code: { type: "string", description: "JavaScript code string to execute (e.g., 'return Array.from(document.querySelectorAll(\"h2\")).map(el => el.textContent.trim());')." }
                  },
                  required: ["code"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "wait_for_condition",
                description: "Pauses and polls for dynamic web page elements or text conditions to appear before continuing (useful for SPAs, pagination, and ajax updates).",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "Optional CSS selector to wait for." },
                    textIncludes: { type: "string", description: "Optional text content to wait for." },
                    timeoutMs: { type: "number", description: "Max time in milliseconds to wait (100 to 10000). Defaults to 3000." }
                  }
                }
              }
            },
            {
              type: "function",
              function: {
                name: "crawl_links",
                description: "Discovers and extracts structured anchor links and navigation paths matching a filter from the current page for deep exploration.",
                parameters: {
                  type: "object",
                  properties: {
                    selector: { type: "string", description: "CSS selector for target links (e.g. 'article a', '.documentation a'). Defaults to 'a[href]'." },
                    keywordFilter: { type: "string", description: "Optional filter keyword for URL or link text." },
                    limit: { type: "number", description: "Max links to return (up to 50). Defaults to 20." }
                  }
                }
              }
            },
            {
              type: "function",
              function: {
                name: "get_page_meta_seo",
                description: "Extracts complete page metadata including OpenGraph cards, Twitter preview tags, JSON-LD schemas, canonical URL, and heading hierarchy (H1-H4).",
                parameters: {
                  type: "object",
                  properties: {
                    includeJsonLd: { type: "boolean", description: "Whether to include raw parsed JSON-LD schemas. Defaults to true." }
                  }
                }
              }
            }
          ];

          response = await fetchWithBackoff(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + openaiApiKey
            },
            signal: currentAbortController.signal,
            body: JSON.stringify({
              model: openaiModelId,
              messages: formattedMessages,
              stream: true,
              tools: openAITools
            })
          });

          if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error?.message || `API Error: ${response.status}`);
          }

          if (!response.body) {
            throw new Error("ReadableStream not supported on this browser.");
          }

          reader = response.body.getReader();
          let openaiToolCalls = [];

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                if (choice) {
                  const delta = choice.delta;
                  if (delta) {
                    const reasoning = delta.reasoning_content || delta.thought || delta.reasoning;
                    if (reasoning) {
                      if (!inThinkingBlock) {
                        accumulatedText += "<thinking>" + reasoning;
                        inThinkingBlock = true;
                      } else {
                        accumulatedText += reasoning;
                      }
                      updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);
                      scrollToBottom();
                    } else if (delta.content) {
                      if (inThinkingBlock) {
                        accumulatedText += "</thinking>" + delta.content;
                        inThinkingBlock = false;
                      } else {
                        accumulatedText += delta.content;
                      }
                      updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);
                      scrollToBottom();
                    }
                    if (delta.tool_calls) {
                      const currentlyThinking = inThinkingBlock || isThinkingContext(accumulatedText, inThinkingBlock);
                      if (!currentlyThinking) {
                        delta.tool_calls.forEach(tc => {
                          const idx = tc.index ?? 0;
                          if (!openaiToolCalls[idx]) {
                            openaiToolCalls[idx] = { id: "", name: "", arguments: "" };
                          }
                          if (tc.id) openaiToolCalls[idx].id = tc.id;
                          if (tc.function) {
                            if (tc.function.name) openaiToolCalls[idx].name += tc.function.name;
                            if (tc.function.arguments) openaiToolCalls[idx].arguments += tc.function.arguments;
                          }
                        });
                      } else {
                        console.warn("Ignored OpenAI tool_call emitted inside thinking block:", delta.tool_calls);
                      }
                    }
                  }
                }
              } catch (e) {}
            }
          }

          if (openaiToolCalls.length > 0) {
            const firstCall = openaiToolCalls[0];
            let parsedArgs = {};
            try { parsedArgs = JSON.parse(firstCall.arguments); } catch(e) {}
            activeFunctionCall = {
              name: firstCall.name,
              args: parsedArgs
            };
            rawModelParts = [
              { text: accumulatedText || "Executing browser tools..." },
              {
                functionCall: {
                  name: firstCall.name,
                  args: parsedArgs
                }
              }
            ];
          } else {
            rawModelParts = [{ text: accumulatedText }];
          }

        } else {
          // Call Gemini API directly with streamGenerateContent and tools enabled
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?key=${apiKey}`;
          
          // Optimize chat history: strip massive base64 inlineData from all past turns to prevent token bloat and extreme latency
          const cleanContents = chatHistory.map((msg, index) => {
            const isPastTurn = index < chatHistory.length - 1;
            const cleanParts = msg.parts.map(part => {
              if (part.inlineData) {
                if (isPastTurn) {
                  return { text: `[Attachment (${part.inlineData.mimeType}) analyzed in previous turn]` };
                }
              }
              return part;
            });
            return {
              role: msg.role,
              parts: cleanParts
            };
          });

          const payload = {
            contents: cleanContents,
            systemInstruction: {
              parts: [{
                text: systemInstructionText
              }]
            },
            tools: [{
              functionDeclarations: [
                {
                  name: "get_page_dom",
                  description: "Retrieves the webpage text context, title, and URL of the active browser tab to answer user context questions.",
                  parameters: {
                    type: "OBJECT",
                    properties: {}
                  }
                },
                ...(isVisionCapable ? [{
                  name: "get_page_screenshot",
                  description: "Captures a visual screenshot of the current visible tab's viewport as base64 JPEG image data.",
                  parameters: {
                    type: "OBJECT",
                    properties: {}
                  }
                }] : []),
                {
                  name: "click_element",
                  description: "Clicks an element on the webpage of the active browser tab by its CSS selector or text context.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: {
                        type: "STRING",
                        description: "CSS selector of the element to click (e.g. 'button', '#submit', '.btn-login', 'a')."
                      },
                      textContext: {
                        type: "STRING",
                        description: "Optional case-insensitive text inside the element to click (e.g. 'Submit', 'Log In', 'Sign Up')."
                      }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "click_at_coordinate",
                  description: "Clicks at a specific coordinate (pixel or percentage) on the active tab's screen to select elements, focus rich-text areas, or click canvas-based elements, and optionally types text.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      x: {
                        type: "NUMBER",
                        description: "X-coordinate (e.g. 50 for 50% width, or 640 for pixel coordinate)."
                      },
                      y: {
                        type: "NUMBER",
                        description: "Y-coordinate (e.g. 30 for 30% height, or 480 for pixel coordinate)."
                      },
                      coordinateType: {
                        type: "STRING",
                        description: "Specify whether coordinates are in 'percentage' (0 to 100) or 'pixels'. Defaults to 'percentage'.",
                        enum: ["percentage", "pixels"]
                      },
                      typeText: {
                        type: "STRING",
                        description: "Optional text to type immediately after clicking (focuses and simulates entering text into rich-text, contenteditable, or standard inputs)."
                      },
                      submitAfter: {
                        type: "BOOLEAN",
                        description: "Whether to submit or hit Enter after typing."
                      }
                    },
                    required: ["x", "y"]
                  }
                },
                {
                  name: "type_text",
                  description: "Types text into an input, textarea, contenteditable div or rich-text editor on the webpage of the active browser tab.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: {
                        type: "STRING",
                        description: "CSS selector of the input/textarea/editor to type into (e.g. 'input[type=\"text\"]', '#search-input', '.ql-editor', '.ProseMirror')."
                      },
                      text: {
                        type: "STRING",
                        description: "The text string to type into the element."
                      },
                      submitAfter: {
                        type: "BOOLEAN",
                        description: "Whether to submit or hit Enter after typing."
                      }
                    },
                    required: ["selector", "text"]
                  }
                },
                {
                  name: "scroll_page",
                  description: "Scrolls the webpage in a given direction by a specified pixel amount or percentage.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      direction: {
                        type: "STRING",
                        description: "The direction to scroll.",
                        enum: ["up", "down", "left", "right"]
                      },
                      amount: {
                        type: "NUMBER",
                        description: "Optional pixel amount to scroll. If omitted, defaults to 75% of the viewport height/width."
                      }
                    },
                    required: ["direction"]
                  }
                },
                {
                  name: "open_tab",
                  description: "Opens a new browser tab with the specified URL.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      url: {
                        type: "STRING",
                        description: "The complete URL to open (e.g., 'https://www.google.com')."
                      }
                    },
                    required: ["url"]
                  }
                },
                {
                  name: "wait",
                  description: "Waits/sleeps for a specified duration of milliseconds before proceeding. Use this when waiting for pages to load, search results to refresh, or animations to finish.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      delayMs: {
                        type: "NUMBER",
                        description: "The wait duration in milliseconds (e.g. 2000 for 2 seconds)."
                      }
                    },
                    required: ["delayMs"]
                  }
                },
                {
                  name: "search_web",
                  description: "Performs a web search for the specified query and navigates to the search results.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      query: {
                        type: "STRING",
                        description: "The search query string."
                      }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "list_tabs",
                  description: "Lists all currently open tabs in the browser, showing their unique IDs, titles, URLs, and active status.",
                  parameters: {
                    type: "OBJECT",
                    properties: {}
                  }
                },
                {
                  name: "switch_tab",
                  description: "Switches the active browser tab to the one with the specified tab ID.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      tabId: {
                        type: "INTEGER",
                        description: "The unique integer ID of the tab to switch to."
                      }
                    },
                    required: ["tabId"]
                  }
                },
                {
                  name: "press_key",
                  description: "Simulates pressing a key (like WASD keys for movement/games, or Enter/Space/Escape) on the webpage.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      key: {
                        type: "STRING",
                        description: "The key to press (e.g. 'w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape')."
                      },
                      selector: {
                        type: "STRING",
                        description: "Optional CSS selector of the element to focus before pressing. If omitted, targets current focus or body."
                      },
                      holdDuration: {
                        type: "INTEGER",
                        description: "Optional duration to hold the key down in milliseconds. Defaults to 50ms."
                      },
                      ctrlKey: { type: "BOOLEAN", description: "Optional. Control key held down." },
                      altKey: { type: "BOOLEAN", description: "Optional. Alt key held down." },
                      shiftKey: { type: "BOOLEAN", description: "Optional. Shift key held down." },
                      metaKey: { type: "BOOLEAN", description: "Optional. Meta/Command key held down." }
                    },
                    required: ["key"]
                  }
                },
                {
                  name: "select_text",
                  description: "Selects/highlights text in the webpage. For input/textarea, focuses and sets selection range. For rich text editors or standard text, uses selection APIs.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: {
                        type: "STRING",
                        description: "Optional CSS selector of the element. If omitted, targets body."
                      },
                      searchText: {
                        type: "STRING",
                        description: "The text string to search for and select/highlight."
                      },
                      startIndex: {
                        type: "INTEGER",
                        description: "Optional character start index for input/textarea selection."
                      },
                      endIndex: {
                        type: "INTEGER",
                        description: "Optional character end index for input/textarea selection."
                      }
                    },
                    required: ["searchText"]
                  }
                },
                {
                  name: "replace_text",
                  description: "Replaces text in the webpage. If searchText is provided, finds and replaces it. If searchText is omitted, replaces the currently selected/highlighted text. Uses standard rich-text editing APIs to preserve document state and history.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: {
                        type: "STRING",
                        description: "Optional CSS selector of the element. If omitted, targets current focus."
                      },
                      searchText: {
                        type: "STRING",
                        description: "Optional text string to find and replace. If omitted, replaces active selection."
                      },
                      replaceText: {
                        type: "STRING",
                        description: "The text to insert/replace with."
                      }
                    },
                    required: ["replaceText"]
                  }
                },
                {
                  name: "extract_links",
                  description: "Extracts all hyperlinks (URLs and anchor texts) on the active webpage, with an optional search filter keyword or CSS selector.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      keyword: { type: "STRING", description: "Optional keyword or search term to filter link URLs or text." },
                      selector: { type: "STRING", description: "Optional CSS selector to scope link extraction (e.g. 'nav', 'main', '.articles')." }
                    }
                  }
                },
                {
                  name: "execute_script",
                  description: "Evaluates custom JavaScript code inside the active webpage context and returns the evaluation output.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      code: { type: "STRING", description: "The JavaScript code string to execute (e.g. 'document.title' or 'window.scrollY')." }
                    },
                    required: ["code"]
                  }
                },
                {
                  name: "go_back_forward",
                  description: "Navigates browser history back or forward on the active tab.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      direction: { type: "STRING", enum: ["back", "forward"], description: "The navigation direction ('back' or 'forward')." }
                    },
                    required: ["direction"]
                  }
                },
                {
                  name: "get_element_details",
                  description: "Inspects an element by CSS selector or text context to retrieve its dimensions, position, inner HTML, text content, and attributes.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: { type: "STRING", description: "CSS selector of the element to inspect." },
                      textContext: { type: "STRING", description: "Optional text context inside the element to match." }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "highlight_element",
                  description: "Visually highlights an element on the webpage with an animated glowing border, optional badge label, and scrolls it into view for the user.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: { type: "STRING", description: "CSS selector of the element to highlight." },
                      color: { type: "STRING", description: "Optional hex or rgba color for the glowing highlight (e.g. '#8b5cf6', '#3b82f6', '#10b981'). Defaults to '#8b5cf6'." },
                      durationMs: { type: "INTEGER", description: "Duration in milliseconds to display the highlight (e.g. 4000). Set to 0 to keep until dismiss. Defaults to 4000." },
                      label: { type: "STRING", description: "Optional text label/badge to display directly above the element." },
                      scrollIntoView: { type: "BOOLEAN", description: "Whether to smoothly scroll the highlighted element into view. Defaults to true." }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "extract_table_data",
                  description: "Extracts tabular data from web tables or grid structures and formats it into structured JSON, CSV, or Markdown.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: { type: "STRING", description: "Optional CSS selector of the table element (e.g. 'table', '#pricing', '.data-grid'). If omitted, extracts the primary table on page." },
                      format: { type: "STRING", description: "Format of the extracted table data ('json', 'csv', or 'markdown'). Defaults to 'json'." },
                      maxRows: { type: "INTEGER", description: "Maximum number of data rows to extract. Defaults to 100." }
                    }
                  }
                },
                {
                  name: "search_tabs",
                  description: "Searches open browser tabs by title or URL keyword and returns matching tabs with their IDs.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      query: { type: "STRING", description: "Search query or keyword to match against tab titles and URLs." }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "close_tab",
                  description: "Closes a specific browser tab by its unique tab ID, or the active tab if omitted.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      tabId: { type: "INTEGER", description: "Optional tab ID to close. If omitted, closes the active tab." }
                    }
                  }
                },
                {
                  name: "fill_form",
                  description: "Fills multiple input fields, textareas, checkboxes, radio buttons, and select dropdowns across the page in one single atomic operation.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      fields: {
                        type: "ARRAY",
                        description: "List of form fields to fill.",
                        items: {
                          type: "OBJECT",
                          properties: {
                            selector: { type: "STRING", description: "Optional CSS selector of the field." },
                            name: { type: "STRING", description: "Optional name or ID attribute of the form field." },
                            label: { type: "STRING", description: "Optional label text, placeholder, or aria-label of the input." },
                            value: { type: "STRING", description: "Value to enter or select. For checkboxes use 'true'/'false'." }
                          },
                          required: ["value"]
                        }
                      },
                      submitAfter: { type: "BOOLEAN", description: "Whether to click the form's submit button after filling. Defaults to false." }
                    },
                    required: ["fields"]
                  }
                },
                {
                  name: "extract_media",
                  description: "Scrapes and extracts all media on the active webpage including images (URLs, alt text, dimensions), videos, audio, and downloadable files (PDF, zip, docx, etc.).",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING", description: "Type of media assets to extract ('all', 'images', 'videos', 'audio', 'documents'). Defaults to 'all'." },
                      minDimensions: { type: "INTEGER", description: "Minimum width/height in px for images to filter out tiny icons. Defaults to 50." }
                    }
                  }
                },
                {
                  name: "compare_tabs",
                  description: "Compares text and metadata between two open browser tabs side-by-side (e.g. comparing products, documentation, or search results).",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      tabIdA: { type: "INTEGER", description: "First tab ID to compare." },
                      tabIdB: { type: "INTEGER", description: "Second tab ID to compare. If omitted, uses the active tab." }
                    },
                    required: ["tabIdA"]
                  }
                },
                {
                  name: "tts_speak",
                  description: "Reads text aloud using text-to-speech browser voice synthesis.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      text: { type: "STRING", description: "The text to read aloud." },
                      rate: { type: "NUMBER", description: "Speech rate (0.5 to 2.0). Defaults to 1.0." },
                      pitch: { type: "NUMBER", description: "Voice pitch (0.5 to 1.5). Defaults to 1.0." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "download_markdown_report",
                  description: "Generates and triggers a browser download for a structured Markdown report or research summary file.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      filename: { type: "STRING", description: "File name for the download (e.g. 'research-summary.md')." },
                      markdownContent: { type: "STRING", description: "The complete Markdown text content to save." }
                    },
                    required: ["filename", "markdownContent"]
                  }
                },
                {
                  name: "update_plan",
                  description: "Maintains and tracks a multi-step plan for long-horizon tasks, declaring sub-goals and updating status ('pending', 'in_progress', 'completed', 'failed').",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      plan: {
                        type: "ARRAY",
                        description: "Array of milestone sub-goals.",
                        items: {
                          type: "OBJECT",
                          properties: {
                            step: { type: "INTEGER", description: "Step number (1, 2, 3...)" },
                            goal: { type: "STRING", description: "Description of the milestone goal." },
                            status: { type: "STRING", description: "Current step status ('pending', 'in_progress', 'completed', 'failed')." },
                            notes: { type: "STRING", description: "Optional notes or outcome summary." }
                          },
                          required: ["step", "goal", "status"]
                        }
                      },
                      currentStepIndex: { type: "INTEGER", description: "The 1-based index of the currently executing step." }
                    },
                    required: ["plan"]
                  }
                },
                {
                  name: "manage_scratchpad",
                  description: "Manages working memory across long-horizon research sessions to store, append, retrieve, or clear intermediate facts, extracted data, and URLs.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      action: { type: "STRING", description: "Action to perform ('read', 'write', 'append', 'clear')." },
                      key: { type: "STRING", description: "Optional key or section name (e.g. 'findings', 'pricing_table', 'sources'). Defaults to 'default'." },
                      content: { type: "STRING", description: "Content text to write or append." }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "execute_custom_script",
                  description: "Executes a custom JavaScript snippet in the webpage context and returns the JSON result for advanced DOM querying or deep page manipulation.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      code: { type: "STRING", description: "JavaScript code string to execute (e.g., 'return Array.from(document.querySelectorAll(\"h2\")).map(el => el.textContent.trim());')." }
                    },
                    required: ["code"]
                  }
                },
                {
                  name: "wait_for_condition",
                  description: "Pauses and polls for dynamic web page elements or text conditions to appear before continuing (useful for SPAs, pagination, and ajax updates).",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: { type: "STRING", description: "Optional CSS selector to wait for." },
                      textIncludes: { type: "STRING", description: "Optional text content to wait for." },
                      timeoutMs: { type: "INTEGER", description: "Max time in milliseconds to wait (100 to 10000). Defaults to 3000." }
                    }
                  }
                },
                {
                  name: "crawl_links",
                  description: "Discovers and extracts structured anchor links and navigation paths matching a filter from the current page for deep exploration.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      selector: { type: "STRING", description: "CSS selector for target links (e.g. 'article a', '.documentation a'). Defaults to 'a[href]'." },
                      keywordFilter: { type: "STRING", description: "Optional filter keyword for URL or link text." },
                      limit: { type: "INTEGER", description: "Max links to return (up to 50). Defaults to 20." }
                    }
                  }
                },
                {
                  name: "get_page_meta_seo",
                  description: "Extracts complete page metadata including OpenGraph cards, Twitter preview tags, JSON-LD schemas, canonical URL, and heading hierarchy (H1-H4).",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      includeJsonLd: { type: "BOOLEAN", description: "Whether to include raw parsed JSON-LD schemas. Defaults to true." }
                    }
                  }
                }
              ]
            }]
          };

          response = await fetchWithBackoff(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            signal: currentAbortController.signal,
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error?.message || `API Error: ${response.status}`);
          }

          if (!response.body) {
            throw new Error("ReadableStream not supported on this browser.");
          }

          reader = response.body.getReader();

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            let b = 0;
            while (b < buffer.length) {
              const startIdx = buffer.indexOf('{', b);
              if (startIdx === -1) {
                break;
              }

              let bracketCount = 0;
              let endIdx = -1;
              let inString = false;
              let escape = false;

              for (let i = startIdx; i < buffer.length; i++) {
                const char = buffer[i];
                if (escape) {
                  escape = false;
                  continue;
                }
                if (char === '\\') {
                  escape = true;
                  continue;
                }
                if (char === '"') {
                  inString = !inString;
                  continue;
                }
                if (!inString) {
                  if (char === '{') {
                    bracketCount++;
                  } else if (char === '}') {
                    bracketCount--;
                    if (bracketCount === 0) {
                      endIdx = i;
                      break;
                    }
                  }
                }
              }

              if (endIdx !== -1) {
                const jsonStr = buffer.substring(startIdx, endIdx + 1);
                try {
                  const obj = JSON.parse(jsonStr);
                  const parts = obj.candidates?.[0]?.content?.parts;
                  if (parts) {
                    rawModelParts.push(...parts);
                    for (const part of parts) {
                      const isThoughtPart = !!part.thought;
                      if (part.text) {
                        if (isThoughtPart && !inThinkingBlock) {
                          accumulatedText += "<thinking>" + part.text;
                          inThinkingBlock = true;
                        } else if (!isThoughtPart && inThinkingBlock) {
                          accumulatedText += "</thinking>" + part.text;
                          inThinkingBlock = false;
                        } else {
                          accumulatedText += part.text;
                        }
                        updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);
                        scrollToBottom();
                      }
                      if (part.functionCall) {
                        const currentlyThinking = isThoughtPart || inThinkingBlock || isThinkingContext(accumulatedText, inThinkingBlock);
                        if (!currentlyThinking) {
                          activeFunctionCall = part.functionCall;
                        } else {
                          console.warn("Ignored function call emitted inside model thinking block:", part.functionCall);
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.warn("Could not parse JSON object in stream:", e);
                }
                b = endIdx + 1;
              } else {
                break;
              }
            }
            buffer = buffer.substring(b);
          }

          if (inThinkingBlock) {
            accumulatedText += "</thinking>";
            inThinkingBlock = false;
            updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);
          }

          if (activeFunctionCall && isThinkingContext(accumulatedText, false)) {
            console.warn("Prevented tool call execution because it was enclosed within thinking tags:", activeFunctionCall);
            activeFunctionCall = null;
          }
        }

        if (activeFunctionCall) {
          // Model requested a tool execution! We set hasMoreTurns to true to send the response back
          hasMoreTurns = true;

          if (currentLoaderDiv && currentLoaderDiv.parentNode === currentAssistantBubble) {
            currentLoaderDiv.remove();
          }

          // Show/Update collapsible tools-block in current assistant bubble
          let toolsBlock = currentAssistantBubble.querySelector(".tools-block");
          if (!toolsBlock) {
            toolsBlock = document.createElement("div");
            toolsBlock.className = "tools-block expanded";
            
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "tools-toggle-btn";
            toggleBtn.type = "button";
            toggleBtn.innerHTML = `
              <span class="tools-header-left">
                <span class="tools-icon">🛠️</span>
                <span class="tools-text">Tool Executions (1)</span>
              </span>
              <span class="tools-arrow">▼</span>
            `;
            
            const contentDiv = document.createElement("div");
            contentDiv.className = "tools-content";
            
            toolsBlock.appendChild(toggleBtn);
            toolsBlock.appendChild(contentDiv);
            
            toggleBtn.addEventListener("click", () => {
              toolsBlock.classList.toggle("collapsed");
              toolsBlock.classList.toggle("expanded");
            });

            // Insert after thinking-block if it exists, otherwise after message-header
            const thinkingBlock = currentAssistantBubble.querySelector(".thinking-block");
            if (thinkingBlock && thinkingBlock.nextSibling) {
              currentAssistantBubble.insertBefore(toolsBlock, thinkingBlock.nextSibling);
            } else {
              const header = currentAssistantBubble.querySelector(".message-header");
              if (header && header.nextSibling) {
                currentAssistantBubble.insertBefore(toolsBlock, header.nextSibling);
              } else {
                currentAssistantBubble.appendChild(toolsBlock);
              }
            }
          }

          const contentDiv = toolsBlock.querySelector(".tools-content");
          const toolCallId = "tc-" + Date.now();
          const toolItem = document.createElement("div");
          toolItem.className = "tool-item-log";
          toolItem.id = toolCallId;
          toolItem.innerHTML = `
            <div class="tool-item-header">
              <span class="tool-item-name">${activeFunctionCall.name}()</span>
              <span class="tool-item-status-spinner">⏳ Running...</span>
            </div>
            <div class="tool-item-response font-mono">Pending execution...</div>
          `;
          contentDiv.appendChild(toolItem);
          
          // Update the count in toggle button
          const count = contentDiv.querySelectorAll(".tool-item-log").length;
          const toolsText = toolsBlock.querySelector(".tools-text");
          if (toolsText) {
            toolsText.textContent = `Tool Executions (${count})`;
          }
          scrollToBottom();

          // 1. Add model's functionCall to chat history (preserving thoughts text and signatures)
          chatHistory.push({
            role: "model",
            parts: rawModelParts
          });

          // 2. Execute the tool
          if (currentAbortController && currentAbortController.signal.aborted) {
            throw new DOMException("Generation stopped by user.", "AbortError");
          }
          const toolResult = await executeTool(activeFunctionCall.name, activeFunctionCall.args);

          // Update toolItem log on success/failure
          const statusSpinner = toolItem.querySelector(".tool-item-status-spinner");
          if (statusSpinner) {
            statusSpinner.textContent = "✅ Success";
            statusSpinner.className = "tool-item-status-success";
          }
          
          const responseDiv = toolItem.querySelector(".tool-item-response");
          if (responseDiv) {
            let note = "Execution complete.";
            if (activeFunctionCall.name === "get_page_dom") {
              note = `Context loaded successfully! URL: ${toolResult.url || ""}`;
            } else if (activeFunctionCall.name === "click_element") {
              note = `Element <${toolResult.tagName?.toLowerCase() || "element"}> clicked.`;
            } else if (activeFunctionCall.name === "click_at_coordinate") {
              note = `Clicked coordinate (${activeFunctionCall.args?.x || 0}, ${activeFunctionCall.args?.y || 0}).`;
            } else if (activeFunctionCall.name === "type_text") {
              note = `Typed text: "${activeFunctionCall.args?.text || ""}"`;
            } else if (activeFunctionCall.name === "scroll_page") {
              note = `Scrolled page ${activeFunctionCall.args?.direction || "down"}.`;
            } else if (activeFunctionCall.name === "open_tab") {
              note = `Opened tab: ${activeFunctionCall.args?.url || ""}`;
            } else if (activeFunctionCall.name === "wait") {
              note = `Waited for ${activeFunctionCall.args?.delayMs || 1000}ms.`;
            } else if (activeFunctionCall.name === "search_web") {
              note = `Searched web for "${activeFunctionCall.args?.query || ""}"`;
            } else if (activeFunctionCall.name === "list_tabs") {
              note = `Listed all open tabs.`;
            } else if (activeFunctionCall.name === "switch_tab") {
              note = `Switched to tab ID ${activeFunctionCall.args?.tabId || ""}.`;
            } else if (activeFunctionCall.name === "press_key") {
              const k = activeFunctionCall.args?.key || "";
              const duration = activeFunctionCall.args?.holdDuration !== undefined ? Number(activeFunctionCall.args?.holdDuration) : 50;
              note = `Pressed key: "${k}"${duration > 50 ? ` (held down for ${duration}ms)` : ""}`;
            } else if (activeFunctionCall.name === "extract_links") {
              note = `Extracted ${toolResult.count || 0} links from page.`;
            } else if (activeFunctionCall.name === "execute_script") {
              note = `Evaluated JavaScript script on tab.`;
            } else if (activeFunctionCall.name === "go_back_forward") {
              note = `Navigated browser history ${activeFunctionCall.args?.direction || "back"}.`;
            } else if (activeFunctionCall.name === "get_element_details") {
              note = `Inspected details for selector "${activeFunctionCall.args?.selector || ""}".`;
            } else if (activeFunctionCall.name === "highlight_element") {
              note = `Highlighted element "${activeFunctionCall.args?.selector || ""}" on page.`;
            } else if (activeFunctionCall.name === "extract_table_data") {
              note = `Extracted table data (${toolResult.rowCount || 0} rows).`;
            } else if (activeFunctionCall.name === "search_tabs") {
              note = `Found ${toolResult.count || 0} tabs matching "${activeFunctionCall.args?.query || ""}".`;
            } else if (activeFunctionCall.name === "close_tab") {
              note = `Closed tab ID ${activeFunctionCall.args?.tabId || "active"}.`;
            } else if (activeFunctionCall.name === "fill_form") {
              note = `Filled ${toolResult.fieldsFilled || 0} form fields successfully.`;
            } else if (activeFunctionCall.name === "extract_media") {
              note = `Extracted ${toolResult.totalMedia || 0} media assets (${toolResult.imageCount || 0} images, ${toolResult.videoCount || 0} videos, ${toolResult.docCount || 0} docs).`;
            } else if (activeFunctionCall.name === "compare_tabs") {
              note = `Compared Tab ${activeFunctionCall.args?.tabIdA} vs Tab ${activeFunctionCall.args?.tabIdB || "active"}.`;
            } else if (activeFunctionCall.name === "tts_speak") {
              note = `Spoke text aloud using browser voice synthesis.`;
            } else if (activeFunctionCall.name === "download_markdown_report") {
              note = `Downloaded report file: "${activeFunctionCall.args?.filename || "report.md"}".`;
            } else if (activeFunctionCall.name === "update_plan") {
              const count = activeFunctionCall.args?.plan?.length || 0;
              const step = activeFunctionCall.args?.currentStepIndex || 1;
              note = `Updated task plan: Step ${step}/${count} (${toolResult.activeGoal || "In Progress"}).`;
            } else if (activeFunctionCall.name === "manage_scratchpad") {
              note = `Scratchpad ${activeFunctionCall.args?.action || "updated"} [key: ${activeFunctionCall.args?.key || "default"}].`;
            } else if (activeFunctionCall.name === "execute_custom_script") {
              note = `Custom JS evaluated: ${toolResult.success ? "Success" : "Error"}.`;
            } else if (activeFunctionCall.name === "wait_for_condition") {
              note = `Condition met in ${toolResult.elapsedMs || 0}ms.`;
            } else if (activeFunctionCall.name === "crawl_links") {
              note = `Crawled and extracted ${toolResult.count || 0} links.`;
            } else if (activeFunctionCall.name === "get_page_meta_seo") {
              note = `Extracted page metadata & JSON-LD schemas (${toolResult.headingsCount || 0} headings).`;
            }
            responseDiv.textContent = note;
          }
          scrollToBottom();

          // 3. Add functionResponse to chat history (with image attachment if it's get_page_screenshot)
          const cleanToolResult = { ...toolResult };
          if (cleanToolResult.screenshot_url) {
            delete cleanToolResult.screenshot_url; // Remove the massive base64 from the textual tool response
          }

          const responseParts = [
            {
              functionResponse: {
                name: activeFunctionCall.name,
                response: {
                  ...cleanToolResult,
                  message: activeFunctionCall.name === "get_page_screenshot" 
                    ? "Screenshot captured successfully and attached as an image part. Please analyze the image to answer."
                    : undefined
                }
              }
            }
          ];

          if (activeFunctionCall.name === "get_page_screenshot" && toolResult.screenshot_url) {
            const mimeMatch = toolResult.screenshot_url.match(/data:(image\/[a-zA-Z+]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            const base64Data = toolResult.screenshot_url.split(",")[1];
            
            // Create a gorgeous visual thumbnail in the assistant bubble
            const imgContainer = document.createElement("div");
            imgContainer.className = "bubble-screenshot-container";
            
            const img = document.createElement("img");
            img.src = toolResult.screenshot_url;
            img.className = "bubble-screenshot-image";
            
            const badge = document.createElement("div");
            badge.className = "bubble-screenshot-badge";
            badge.textContent = "Captured Viewport 📷 (Click to Expand)";
            
            imgContainer.appendChild(img);
            imgContainer.appendChild(badge);
            
            // Interactive click-to-expand toggling
            imgContainer.addEventListener("click", () => {
              if (imgContainer.style.maxHeight === "none") {
                imgContainer.style.maxHeight = "150px";
                img.style.maxHeight = "150px";
                badge.textContent = "Captured Viewport 📷 (Click to Expand)";
              } else {
                imgContainer.style.maxHeight = "none";
                img.style.maxHeight = "none";
                badge.textContent = "Click to Collapse ✕";
              }
            });

            toolItem.appendChild(imgContainer);
            scrollToBottom();

            responseParts.push({
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            });
          }

          chatHistory.push({
            role: "user",
            parts: responseParts
          });

          // Re-create a loader spinner for the next model turn
          currentLoaderDiv = document.createElement("div");
          currentLoaderDiv.className = "loading-indicator";
          currentLoaderDiv.innerHTML = '<div class="spinner"></div> <span>Analyzing retrieved browser context...</span>';
          currentAssistantBubble.appendChild(currentLoaderDiv);
          scrollToBottom();

        } else {
          // No more tool calls, regular final response
          if (!accumulatedText) {
            throw new Error("No text content returned from the stream.");
          }

          // Append assistant response to history list
          chatHistory.push({
            role: "model",
            parts: rawModelParts
          });

          // Save history to local storage
          saveChatsToStorage();
        }
      }

    } catch (err) {
      console.error(err);
      if (loaderDiv && loaderDiv.parentNode === assistantBubble) {
        loaderDiv.remove();
      }
      
      const errorDiv = document.createElement("div");
      errorDiv.className = "bubble-text";
      if (err.name === "AbortError") {
        errorDiv.style.color = "#fbbf24"; // warning amber
        errorDiv.textContent = "Generation stopped by user.";
      } else {
        errorDiv.style.color = "#f87171"; // error red
        errorDiv.textContent = `Error: ${err.message || "Failed to contact Gemini API."}`;
        // Remove last user message from history so they can retry it easily
        chatHistory.pop();
      }
      assistantBubble.appendChild(errorDiv);
    } finally {
      setStopState(false);
      saveChatsToStorage();
      scrollToBottom();
    }
  }

  // Pure JavaScript Client-Side Markdown and LaTeX Parser
  function formatResponse(text) {
    if (!text) return "";
    
    const mathBlocks = [];
    let processedText = text;

    // 1. Extract Display Math: $$ ... $$ or \[ ... \]
    processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
      const id = `%%LATEXBLOCK${mathBlocks.length}%%`;
      const rendered = renderLatexToHtml(formula.trim(), true);
      mathBlocks.push({ id, rendered });
      return id;
    });

    processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
      const id = `%%LATEXBLOCK${mathBlocks.length}%%`;
      const rendered = renderLatexToHtml(formula.trim(), true);
      mathBlocks.push({ id, rendered });
      return id;
    });

    // 2. Extract Inline Math: $ ... $ or \( ... \)
    processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      if (/^\d+(\.\d+)?(M|K|B)?$/.test(formula)) {
        return match; 
      }
      const id = `%%LATEXINLINE${mathBlocks.length}%%`;
      const rendered = renderLatexToHtml(formula.trim(), false);
      mathBlocks.push({ id, rendered });
      return id;
    });

    processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
      const id = `%%LATEXINLINE${mathBlocks.length}%%`;
      const rendered = renderLatexToHtml(formula.trim(), false);
      mathBlocks.push({ id, rendered });
      return id;
    });

    // 3. Extract Code Blocks: ```lang\ncode\n```
    const codeBlocks = [];
    processedText = processedText.replace(/```(\w*)[^\n\r]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `%%CODEBLOCK${codeBlocks.length}%%`;
      codeBlocks.push({ id, lang: lang || 'code', code: code });
      return id;
    });

    // 4. Now safely escape HTML of the remaining text (protecting placeholders, which don't have & < >)
    let escaped = processedText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 5. Parse Inline Code: `code`
    escaped = escaped.replace(/`([^`\n]+?)`/g, (match, code) => {
      return `<code class="inline-code">${code}</code>`;
    });

    // 6. Parse Headers
    escaped = escaped.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // 7. Bold & Italic
    escaped = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([\s\S]+?)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([\s\S]+?)_/g, '<em>$1</em>');

    // 8. Blockquotes
    escaped = escaped.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');

    // 9. Lists
    escaped = escaped.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
    escaped = escaped.replace(/^\s*\d+\.\s+(.*?)$/gm, '<li class="ordered">$1</li>');

    // 9.5 Parse Tables
    const linesArr = escaped.split(/\r?\n/);
    const newLines = [];
    let inTable = false;
    let tableHeader = null;
    let tableAlignments = [];
    let tableRows = [];

    function isTableLine(l) {
      const trimmed = l.trim();
      return trimmed.startsWith('|') && trimmed.endsWith('|');
    }

    function isSeparatorLine(l) {
      const trimmed = l.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
      const cleaned = trimmed.replace(/[|:\s-]/g, '');
      return cleaned === '' && trimmed.includes('-');
    }

    function renderTableHtml(header, alignments, rows) {
      let html = '<div class="table-container"><table>';
      html += '<thead><tr>';
      header.forEach((cell, idx) => {
        const align = alignments[idx] ? ` style="text-align: ${alignments[idx]}"` : '';
        html += `<th${align}>${cell}</th>`;
      });
      html += '</tr></thead>';
      html += '<tbody>';
      rows.forEach(row => {
        html += '<tr>';
        for (let idx = 0; idx < header.length; idx++) {
          const cell = row[idx] || '';
          const align = alignments[idx] ? ` style="text-align: ${alignments[idx]}"` : '';
          html += `<td${align}>${cell}</td>`;
        }
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      return html;
    }

    for (let i = 0; i < linesArr.length; i++) {
      const line = linesArr[i];
      if (isTableLine(line)) {
        if (!inTable) {
          let hasSeparator = false;
          if (i + 1 < linesArr.length && isTableLine(linesArr[i + 1]) && isSeparatorLine(linesArr[i + 1])) {
            hasSeparator = true;
          }
          if (hasSeparator) {
            inTable = true;
            const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
            tableHeader = cells;
            const separatorLine = linesArr[i + 1];
            const sepCells = separatorLine.trim().slice(1, -1).split('|').map(c => c.trim());
            tableAlignments = sepCells.map(cell => {
              const left = cell.startsWith(':');
              const right = cell.endsWith(':');
              if (left && right) return 'center';
              if (right) return 'right';
              if (left) return 'left';
              return '';
            });
            tableRows = [];
            i++; // skip separator
          } else {
            newLines.push(line);
          }
        } else {
          const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
          tableRows.push(cells);
        }
      } else {
        if (inTable) {
          newLines.push(renderTableHtml(tableHeader, tableAlignments, tableRows));
          inTable = false;
          tableHeader = null;
          tableAlignments = [];
          tableRows = [];
        }
        newLines.push(line);
      }
    }
    if (inTable) {
      newLines.push(renderTableHtml(tableHeader, tableAlignments, tableRows));
    }
    escaped = newLines.join('\n');

    // 10. Paragraphs and Newlines
    const lines = escaped.split(/\n{2,}/);
    const formattedParagraphs = lines.map(line => {
      line = line.trim();
      if (!line) return "";
      
      if (line.startsWith("%%CODEBLOCK") || 
          line.startsWith("%%LATEXBLOCK") || 
          line.startsWith("%%LATEXINLINE") || 
          line.startsWith("<h") || 
          line.startsWith("<blockquote") ||
          line.startsWith("<li") ||
          line.startsWith("<div class=\"table-container\"")) {
        return line;
      }
      
      return `<p>${line.replace(/\n/g, '<br>')}</p>`;
    });
    
    escaped = formattedParagraphs.filter(Boolean).join("\n");

    // 11. Group adjacent list items
    escaped = escaped.replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    escaped = escaped.replace(/(<li class="ordered">.*?<\/li>\n?)+/g, (match) => {
      const clean = match.replace(/ class="ordered"/g, '');
      return `<ol>${clean}</ol>`;
    });

    // 12. Re-insert Code Blocks with copy buttons
    codeBlocks.forEach((item) => {
      const cleanCode = item.code.trim();
      const codeHtml = `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-block-lang">${item.lang}</span>
            <button class="code-copy-btn">Copy</button>
            <pre class="hidden-code-text" style="display:none">${cleanCode}</pre>
          </div>
          <pre class="code-block-content"><code>${cleanCode}</code></pre>
        </div>
      `;
      escaped = escaped.replace(item.id, () => codeHtml);
    });

    // 13. Re-insert LaTeX Blocks & Inlines
    mathBlocks.forEach((block) => {
      escaped = escaped.replace(block.id, () => block.rendered);
    });

    return escaped;
  }

  // Unicode LaTeX math parser with KaTeX fallback
  function renderLatexToHtml(formula, isBlock = false) {
    if (!formula) return "";

    // Attempt KaTeX first
    if (typeof katex !== 'undefined' && katex.renderToString) {
      try {
        return katex.renderToString(formula, {
          displayMode: isBlock,
          throwOnError: false
        });
      } catch (e) {
        console.warn("KaTeX rendering failed, falling back to basic parser", e);
      }
    }

    // Fallback: Pure CSS and unicode rendering
    let html = formula;

    // Greek Alphabet and Common Math Symbols
    const replacements = {
      '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\epsilon': 'ε',
      '\\\\zeta': 'ζ', '\\\\eta': 'η', '\\\\theta': 'θ', '\\\\iota': 'ι', '\\\\kappa': 'κ',
      '\\\\lambda': 'λ', '\\\\mu': 'μ', '\\\\nu': 'ν', '\\\\xi': 'ξ', '\\\\pi': 'π',
      '\\\\rho': 'ρ', '\\\\sigma': 'σ', '\\\\tau': 'τ', '\\\\upsilon': 'υ', '\\\\phi': 'φ',
      '\\\\chi': 'χ', '\\\\psi': 'ψ', '\\\\omega': 'ω',
      '\\\\Delta': 'Δ', '\\\\Gamma': 'Γ', '\\\\Theta': 'Θ', '\\\\Lambda': 'Λ', '\\\\Xi': 'Ξ',
      '\\\\Pi': 'Π', '\\\\Sigma': 'Σ', '\\\\Phi': 'Φ', '\\\\Psi': 'Ψ', '\\\\Omega': 'Ω',
      '\\\\infty': '∞', '\\\\pm': '±', '\\\\times': '×', '\\\\div': '÷', 
      '\\\\neq': '≠', '\\\\approx': '≈', '\\\\leq': '≤', '\\\\geq': '≥', '\\\\le': '≤', '\\\\ge': '≥',
      '\\\\to': '→', '\\\\rightarrow': '→', '\\\\leftarrow': '←', '\\\\leftrightarrow': '↔',
      '\\\\partial': '∂', '\\\\nabla': '∇', '\\\\cdot': '·', '\\\\bullet': '•',
      '\\\\forall': '∀', '\\\\exists': '∃', '\\\\in': '∈', '\\\\notin': '∉', '\\\\ni': '∋',
      '\\\\subset': '⊂', '\\\\supset': '⊃', '\\\\subseteq': '⊆', '\\\\supseteq': '⊇',
      '\\\\cup': '∪', '\\\\cap': '∩', '\\\\empty': '∅', '\\\\varnothing': '∅',
      '\\\\int': '∫', '\\\\sum': '∑', '\\\\prod': '∏', '\\\\sqrt': '√'
    };

    const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const regex = new RegExp(key, 'g');
      html = html.replace(regex, replacements[key]);
    }

    // Square roots: \sqrt{expression}
    html = html.replace(/\\sqrt\{([^\}]+?)\}/g, '<span class="latex-sqrt"><span class="latex-sqrt-radical">√</span><span class="latex-sqrt-content">$1</span></span>');

    // Fractions: \frac{num}{den}
    html = html.replace(/\\frac\{([^\}]+?)\}\{([^\}]+?)\}/g, '<span class="latex-frac"><span class="latex-num">$1</span><span class="latex-den">$2</span></span>');

    // Superscripts & Subscripts (grouped with braces first)
    html = html.replace(/\^\{([^\}]+?)\}/g, '<sup>$1</sup>');
    html = html.replace(/_\{([^\}]+?)\}/g, '<sub>$1</sub>');

    // Single character superscripts and subscripts
    html = html.replace(/\^([a-zA-Z0-9\-+*=])/g, '<sup>$1</sup>');
    html = html.replace(/_([a-zA-Z0-9\-+*=])/g, '<sub>$1</sub>');

    // Clean remaining tags
    html = html.replace(/\\mathrm\{([^\}]+?)\}/g, '$1');
    html = html.replace(/\\text\{([^\}]+?)\}/g, '$1');
    html = html.replace(/\\left/g, '');
    html = html.replace(/\\right/g, '');
    html = html.replace(/\\/g, '');

    if (isBlock) {
      return `
        <div class="latex-block">
          <div class="latex-formula">${html}</div>
        </div>
      `;
    } else {
      return `<span class="latex-inline">${html}</span>`;
    }
  }

  // Generates a high-quality, valid mock JPEG browser screenshot to feed into Gemini API vision encoder
  function generateMockScreenshot(title, url, text) {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // Background
    ctx.fillStyle = "#0f172a"; // Slate-900
    ctx.fillRect(0, 0, 800, 600);

    // Browser top bar
    ctx.fillStyle = "#1e293b"; // Slate-800
    ctx.fillRect(0, 0, 800, 60);

    // Browser address bar
    ctx.fillStyle = "#0f172a"; // Slate-900
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(120, 12, 560, 36, 8);
    } else {
      ctx.rect(120, 12, 560, 36);
    }
    ctx.fill();

    // Draw three color dots (browser controls)
    ctx.fillStyle = "#ef4444"; // red
    ctx.beginPath(); ctx.arc(25, 30, 6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#f59e0b"; // yellow
    ctx.beginPath(); ctx.arc(45, 30, 6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#10b981"; // green
    ctx.beginPath(); ctx.arc(65, 30, 6, 0, 2 * Math.PI); ctx.fill();

    // Address text
    ctx.fillStyle = "#94a3b8"; // Slate-400
    ctx.font = "13px monospace";
    ctx.fillText(url || "chrome://restricted-page", 140, 34);

    // Page Content Box
    ctx.fillStyle = "#1e293b"; // Slate-800
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(40, 100, 720, 460, 16);
    } else {
      ctx.rect(40, 100, 720, 460);
    }
    ctx.fill();

    // Header Icon/Badge
    ctx.fillStyle = "#3b82f6"; // Blue
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(80, 140, 100, 100, 12);
    } else {
      ctx.rect(80, 140, 100, 100);
    }
    ctx.fill();
    
    // Icon letter
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText((title && title.charAt(0)) || "W", 112, 208);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(title || "Restricted System Tab", 200, 180);

    // Simulated Web URL subtitle
    ctx.fillStyle = "#60a5fa"; // blue-400
    ctx.font = "14px sans-serif";
    ctx.fillText("Active Extension Simulator Viewport", 200, 210);

    // Divider
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 270);
    ctx.lineTo(720, 270);
    ctx.stroke();

    // Text content wrapped
    ctx.fillStyle = "#cbd5e1"; // Slate-300
    ctx.font = "15px sans-serif";
    const words = (text || "This page has high security protection and cannot be screenshotted directly by Extensions. Rest assured, context is fully active and protected.").split(" ");
    let line = "";
    let y = 310;
    const maxWidth = 640;
    const lineHeight = 24;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 80, y);
        line = words[n] + " ";
        y += lineHeight;
        if (y > 500) break;
      } else {
        line = testLine;
      }
    }
    if (y <= 500) {
      ctx.fillText(line, 80, y);
    }

    // Visual simulated button
    ctx.fillStyle = "#3b82f6"; // blue button
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(80, Math.min(y + 20, 520), 160, 36, 6);
    } else {
      ctx.rect(80, Math.min(y + 20, 520), 160, 36);
    }
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("Interactive Action", 110, Math.min(y + 20, 520) + 22);

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // Context extraction tool executor
  function executeTool(name, args) {
    return new Promise(async (resolve) => {
      const simulateTyping = async (initialTarget, text, submit) => {
        if (!initialTarget) return;

        // 1. Give focus-shifting events a moment to settle
        await new Promise((r) => setTimeout(r, 20));

        // 2. Determine actual input/editing target
        let target = initialTarget;
        if (document.activeElement && (
          document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.isContentEditable ||
          document.activeElement.getAttribute('role') === 'textbox' ||
          document.activeElement.classList.contains('docs-textarea')
        )) {
          target = document.activeElement;
        } else {
          const docTextarea = document.querySelector('.docs-textarea');
          if (docTextarea) {
            target = docTextarea;
          }
        }

        target.focus();

        // 3. Special handling for Google Docs (.docs-textarea)
        const isGoogleDocs = target.classList.contains('docs-textarea') || 
                             window.location.hostname.includes('docs.google.com') ||
                             document.querySelector('.docs-textarea') !== null;

        if (isGoogleDocs) {
          try {
            // Focus the textarea
            target.focus();

            // Try 1: textInput event (often used by older/rich editors)
            try {
              const textEvent = document.createEvent('TextEvent');
              textEvent.initTextEvent('textInput', true, true, window, text, 0, 'en-US');
              target.dispatchEvent(textEvent);
            } catch (e) {}

            // Try 2: beforeinput + input event (modern standard for Google Docs / rich editors)
            try {
              const beforeInputEvent = new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
              });
              target.dispatchEvent(beforeInputEvent);
            } catch (e) {}

            // Try 3: Direct value setting + input event
            // Google Docs keeps the textarea empty or with placeholder. Let's set the value and trigger input.
            const originalValue = target.value;
            target.value = text;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));

            // Try 4: Synthetic paste event (backup)
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dataTransfer
            });
            target.dispatchEvent(pasteEvent);

            // Try 5: If nothing else, dispatch individual character key events
            for (let i = 0; i < text.length; i++) {
              if (currentAbortController && currentAbortController.signal.aborted) {
                return;
              }
              const char = text[i];
              const keyCode = char.toUpperCase().charCodeAt(0);
              const charCode = char.charCodeAt(0);

              target.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
              target.dispatchEvent(new KeyboardEvent('keypress', { key: char, keyCode: charCode, which: charCode, bubbles: true, cancelable: true }));
              
              target.value = char;
              target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
              
              target.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Key${char.toUpperCase()}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
            }
            
            // Clear the textarea value back to empty so Docs doesn't get confused by stale text in the buffer
            target.value = "";
            target.dispatchEvent(new Event('input', { bubbles: true }));

            if (submit) {
              const activeEl = document.activeElement || target;
              activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }
            return;
          } catch (err) {}
        }

        // 4. Character by character typing fallback
        for (let i = 0; i < text.length; i++) {
          if (currentAbortController && currentAbortController.signal.aborted) {
            return;
          }
          const char = text[i];
          const charCode = char.charCodeAt(0);
          const keyCode = char.toUpperCase().charCodeAt(0);

          // Keydown
          const keydownEvent = new KeyboardEvent('keydown', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(keydownEvent);

          // BeforeInput
          let beforeInputAllowed = true;
          try {
            const beforeInputEvent = new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: char
            });
            beforeInputAllowed = target.dispatchEvent(beforeInputEvent);
          } catch (e) {}

          if (beforeInputAllowed) {
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
              const start = target.selectionStart || 0;
              const end = target.selectionEnd || 0;
              const oldVal = target.value;
              const newVal = oldVal.substring(0, start) + char + oldVal.substring(end);
              
              const prototype = Object.getPrototypeOf(target);
              const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
              if (setter) {
                setter.call(target, newVal);
              } else {
                target.value = newVal;
              }
              target.selectionStart = target.selectionEnd = start + 1;
            } else {
              const targetEditable = target.isContentEditable ? target : (
                target.querySelector('[contenteditable="true"]') ||
                target.querySelector('.ql-editor') ||
                target.querySelector('.public-DraftEditor-content') ||
                target.querySelector('.ProseMirror') ||
                target.querySelector('[role="textbox"]')
              );

              if (targetEditable) {
                targetEditable.focus();
                
                let textEventHandled = false;
                try {
                  const textEvent = document.createEvent('TextEvent');
                  textEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
                  textEventHandled = targetEditable.dispatchEvent(textEvent);
                } catch (e) {}

                if (!textEventHandled) {
                  try {
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      range.deleteContents();
                      const textNode = document.createTextNode(char);
                      range.insertNode(textNode);
                      range.setStartAfter(textNode);
                      range.setEndAfter(textNode);
                      selection.removeAllRanges();
                      selection.addRange(range);
                    } else {
                      document.execCommand('insertText', false, char);
                    }
                  } catch (err) {
                    try {
                      document.execCommand('insertText', false, char);
                    } catch (e2) {
                      targetEditable.innerText += char;
                    }
                  }
                }
              } else {
                try {
                  const textEvent = document.createEvent('TextEvent');
                  textEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
                  target.dispatchEvent(textEvent);
                } catch (e) {}

                try {
                  document.execCommand('insertText', false, char);
                } catch (err) {
                  target.innerText += char;
                }
              }
            }

            // Input
            try {
              const inputEvent = new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: char
              });
              target.dispatchEvent(inputEvent);
            } catch (e) {
              target.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }

          // Keypress
          const keypressEvent = new KeyboardEvent('keypress', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: charCode,
            which: charCode,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(keypressEvent);

          // Keyup
          const keyupEvent = new KeyboardEvent('keyup', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(keyupEvent);

          await new Promise((r) => setTimeout(r, 10));
        }

        target.dispatchEvent(new Event('change', { bubbles: true }));

        if (submit) {
          const form = target.form || (target.closest ? target.closest('form') : null);
          if (form) {
            if (form.requestSubmit) form.requestSubmit();
            else form.submit();
          } else {
            const activeEl = document.activeElement || target;
            activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          }
        }
      };

      if (typeof chrome === "undefined" || !chrome.tabs) {
        // Outside extension environment fallback
        if (name === "get_page_dom") {
          resolve({
            success: true,
            title: "AcceleratedLogic AI Blog",
            url: "https://acceleratedlogic.ai/blog/launch",
            text: "This is a simulated DOM context content. Manifest V3 Side Panels and high-context models transform browsers into active runtime workspaces. This sidebar is fully context-aware. With a single click, users can capture the page DOM or query visual layouts directly."
          });
        } else if (name === "get_page_screenshot") {
          resolve({
            success: true,
            screenshot_url: generateMockScreenshot(
              "AcceleratedLogic AI Blog",
              "https://acceleratedlogic.ai/blog/launch",
              "This is a simulated DOM context content. Manifest V3 Side Panels and high-context models transform browsers into active runtime workspaces. This sidebar is fully context-aware. With a single click, users can capture the page DOM or query visual layouts directly."
            )
          });
        } else if (name === "click_element") {
          const sel = args.selector || "";
          const txt = args.textContext || "";
          let elements = [];
          if (sel) {
            try {
              elements = Array.from(document.querySelectorAll(sel));
            } catch (e) {}
          } else if (txt) {
            elements = Array.from(document.querySelectorAll("button, a, input, [role='button'], span, p, div"));
          }

          if (txt && elements.length > 0) {
            const lowerText = txt.toLowerCase().trim();
            elements = elements.filter(el => {
              const elText = el.textContent || el.innerText || "";
              return elText.toLowerCase().trim().includes(lowerText);
            });
          }

          const target = elements[0];
          if (target) {
            try {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.click();
              resolve({
                success: true,
                tagName: target.tagName,
                id: target.id,
                text: (target.textContent || "").substring(0, 50).trim(),
                message: `[Simulator] Found and clicked <${target.tagName.toLowerCase()}> element on current screen.`
              });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          } else {
            resolve({
              success: true,
              message: `[Simulator Fallback] Element matching '${sel || txt}' clicked successfully in virtual browser space.`
            });
          }
        } else if (name === "click_at_coordinate") {
          const x = args.x;
          const y = args.y;
          const coordType = args.coordinateType || "percentage";
          const typeText = args.typeText || "";
          const submitAfter = !!args.submitAfter;

          const viewport = document.getElementById("simulated-webpage-viewport") || document.body;
          let clientX, clientY;
          const rect = viewport.getBoundingClientRect();
          if (coordType === "percentage") {
            clientX = rect.left + (x / 100) * rect.width;
            clientY = rect.top + (y / 100) * rect.height;
          } else {
            clientX = rect.left + x;
            clientY = rect.top + y;
          }

          // Trigger visual indicator
          const dot = document.createElement("div");
          dot.style.position = "fixed";
          dot.style.left = `${clientX - 12}px`;
          dot.style.top = `${clientY - 12}px`;
          dot.style.width = "24px";
          dot.style.height = "24px";
          dot.style.borderRadius = "50%";
          dot.style.backgroundColor = "rgba(59, 130, 246, 0.4)";
          dot.style.border = "2px solid #60a5fa";
          dot.style.boxShadow = "0 0 12px #3b82f6";
          dot.style.pointerEvents = "none";
          dot.style.zIndex = "99999";
          dot.style.transition = "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
          dot.style.transform = "scale(0.5)";
          dot.style.opacity = "0";
          document.body.appendChild(dot);
          
          requestAnimationFrame(() => {
            dot.style.transform = "scale(1.5)";
            dot.style.opacity = "1";
            setTimeout(() => {
              dot.style.transform = "scale(2.5)";
              dot.style.opacity = "0";
              setTimeout(() => { dot.remove(); }, 600);
            }, 400);
          });

          // Element from point
          const target = document.elementFromPoint(clientX, clientY);
          if (target) {
            try {
              target.focus();
              target.click();
              target.dispatchEvent(new MouseEvent('mousedown', { clientX, clientY, bubbles: true }));
              target.dispatchEvent(new MouseEvent('mouseup', { clientX, clientY, bubbles: true }));

              let typedMsg = "";
              if (typeText) {
                await simulateTyping(target, typeText, submitAfter);
                typedMsg = ` and typed "${typeText}"`;
              }

              resolve({
                success: true,
                tagName: target.tagName,
                id: target.id,
                message: `[Simulator] Clicked coordinate (${x}, ${y}) targeting <${target.tagName.toLowerCase()}>${typedMsg}.`
              });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          } else {
            resolve({
              success: true,
              message: `[Simulator Fallback] Clicked coordinate (${x}, ${y}) in virtual space.`
            });
          }
        } else if (name === "type_text") {
          const sel = args.selector || "";
          const txt = args.text || "";
          const submitAfter = !!args.submitAfter;
          let target = null;
          try {
            target = document.querySelector(sel);
          } catch (e) {}

          if (target) {
            try {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.focus();

              await simulateTyping(target, txt, submitAfter);

              resolve({
                success: true,
                tagName: target.tagName,
                id: target.id,
                message: `[Simulator] Typed "${txt}" into target element on current screen.`
              });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          } else {
            resolve({
              success: true,
              message: `[Simulator Fallback] Typed "${txt}" into virtual input field matching '${sel}'.`
            });
          }
        } else if (name === "scroll_page") {
          const dir = args.direction || "down";
          const amt = args.amount || 500;
          const viewport = document.getElementById("simulated-webpage-viewport") || window;
          let scrollX = 0;
          let scrollY = 0;
          if (dir === "down") scrollY = amt;
          else if (dir === "up") scrollY = -amt;
          else if (dir === "right") scrollX = amt;
          else if (dir === "left") scrollX = -amt;

          if (viewport.scrollBy) {
            viewport.scrollBy({ left: scrollX, top: scrollY, behavior: "smooth" });
          } else {
            viewport.scrollLeft += scrollX;
            viewport.scrollTop += scrollY;
          }

          await new Promise(r => setTimeout(r, 350));

          const scrollTop = viewport === window ? (window.pageYOffset || document.documentElement.scrollTop) : viewport.scrollTop;
          const scrollLeft = viewport === window ? (window.pageXOffset || document.documentElement.scrollLeft) : viewport.scrollLeft;
          const scrollHeight = viewport === window ? document.documentElement.scrollHeight : viewport.scrollHeight;
          const scrollWidth = viewport === window ? document.documentElement.scrollWidth : viewport.scrollWidth;
          const clientHeight = viewport === window ? window.innerHeight : viewport.clientHeight;
          const clientWidth = viewport === window ? window.innerWidth : viewport.clientWidth;
          const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
          const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);

          resolve({
            success: true,
            message: `[Simulator] Scrolled page ${dir} by ${amt} pixels.`,
            scrollPosition: {
              scrollTop: Math.round(scrollTop),
              scrollLeft: Math.round(scrollLeft),
              maxScrollTop: Math.round(maxScrollTop),
              maxScrollLeft: Math.round(maxScrollLeft),
              isAtTop: scrollTop <= 5,
              isAtBottom: scrollTop >= maxScrollTop - 5,
              scrollPercentage: maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0
            }
          });
        } else if (name === "open_tab") {
          const url = args.url;
          resolve({
            success: true,
            url: url,
            message: `[Simulator] Successfully opened a new tab in background: ${url}`
          });
        } else if (name === "wait") {
          const delay = Number(args.delayMs) || 1000;
          setTimeout(() => {
            resolve({
              success: true,
              delayMs: delay,
              message: `[Simulator] Successfully waited/slept for ${delay}ms.`
            });
          }, delay);
        } else if (name === "search_web") {
          const query = args.query;
          resolve({
            success: true,
            query: query,
            message: `[Simulator] Searched the web for "${query}". Displaying top search results.`
          });
        } else if (name === "list_tabs") {
          resolve({
            success: true,
            tabs: [
              { id: 1, title: "AcceleratedLogic AI", url: "https://acceleratedlogic.ai", active: true },
              { id: 2, title: "Google Search - Gemini API Documentation", url: "https://www.google.com/search?q=gemini+api+documentation", active: false }
            ]
          });
        } else if (name === "switch_tab") {
          const targetId = Number(args.tabId);
          resolve({
            success: true,
            tabId: targetId,
            message: `[Simulator Fallback] Successfully switched active tab to tab ID ${targetId}.`
          });
        } else if (name === "press_key") {
          const key = args.key || "";
          const duration = args.holdDuration !== undefined ? Number(args.holdDuration) : 50;
          resolve({
            success: true,
            key: key,
            holdDuration: duration,
            message: `[Simulator Fallback] Successfully pressed key "${key}" and held it down for ${duration}ms in virtual space.`
          });
        } else if (name === "select_text") {
          const txt = args.searchText || "";
          resolve({
            success: true,
            searchText: txt,
            message: `[Simulator Fallback] Successfully selected and highlighted text "${txt}" in virtual space.`
          });
        } else if (name === "replace_text") {
          const rep = args.replaceText || "";
          resolve({
            success: true,
            replaceText: rep,
            message: `[Simulator Fallback] Successfully replaced selected text with "${rep}" in virtual space.`
          });
        } else if (name === "extract_links") {
          const kw = args.keyword || "";
          resolve({
            success: true,
            count: 4,
            links: [
              { href: "https://acceleratedlogic.ai/docs", text: "Documentation", title: "API Docs" },
              { href: "https://acceleratedlogic.ai/features", text: "Extension Features", title: "Features" },
              { href: "https://github.com/AcceleratedLogic", text: "GitHub Repository", title: "GitHub" },
              { href: "https://acceleratedlogic.ai/contact", text: "Contact Support", title: "Support" }
            ],
            message: `[Simulator Fallback] Extracted hyperlinks from page${kw ? ` matching keyword "${kw}"` : ''}.`
          });
        } else if (name === "execute_script") {
          const codeStr = args.code || "";
          resolve({
            success: true,
            result: `[Simulator Execution] Successfully evaluated script: ${codeStr}`,
            output: "window.scrollY = 0; document.title = 'AcceleratedLogic';"
          });
        } else if (name === "go_back_forward") {
          const dir = args.direction || "back";
          resolve({
            success: true,
            direction: dir,
            message: `[Simulator Fallback] Successfully navigated browser history ${dir}.`
          });
        } else if (name === "get_element_details") {
          const sel = args.selector || "";
          resolve({
            success: true,
            tagName: "DIV",
            id: "app-container",
            className: "main-wrapper flex",
            rect: { x: 40, y: 100, width: 720, height: 460 },
            textContent: "AcceleratedLogic AI Assistant active viewport element content.",
            attributes: { id: "app-container", class: "main-wrapper flex", "data-active": "true" },
            isVisible: true
          });
        } else if (name === "highlight_element") {
          const sel = args.selector || "";
          const col = args.color || "#8b5cf6";
          const lbl = args.label || "";
          resolve({
            success: true,
            selector: sel,
            color: col,
            label: lbl || undefined,
            rect: { x: 50, y: 120, width: 340, height: 48 },
            message: `[Simulator Fallback] Successfully highlighted element "${sel}" with ${col} glow in virtual viewport.`
          });
        } else if (name === "extract_table_data") {
          const sel = args.selector || "";
          resolve({
            success: true,
            tableCount: 1,
            headers: ["Feature / Metric", "Standard Tier", "Pro Edition", "Enterprise Agent"],
            rowCount: 4,
            data: [
              { "Feature / Metric": "Autonomous Agent Turns", "Standard Tier": "5 turns", "Pro Edition": "15 turns", "Enterprise Agent": "Unlimited" },
              { "Feature / Metric": "DOM & Vision Analysis", "Standard Tier": "Yes", "Pro Edition": "Yes", "Enterprise Agent": "Yes" },
              { "Feature / Metric": "Table & CSV Extraction", "Standard Tier": "Basic", "Pro Edition": "High Precision", "Enterprise Agent": "Multi-table streaming" },
              { "Feature / Metric": "Response Speed", "Standard Tier": "Fast (1.2s)", "Pro Edition": "Ultra (0.4s)", "Enterprise Agent": "Instantaneous" }
            ],
            csv: `"Feature / Metric","Standard Tier","Pro Edition","Enterprise Agent"\n"Autonomous Agent Turns","5 turns","15 turns","Unlimited"\n"DOM & Vision Analysis","Yes","Yes","Yes"\n"Table & CSV Extraction","Basic","High Precision","Multi-table streaming"\n"Response Speed","Fast (1.2s)","Ultra (0.4s)","Instantaneous"`,
            markdown: `| Feature / Metric | Standard Tier | Pro Edition | Enterprise Agent |\n| --- | --- | --- | --- |\n| Autonomous Agent Turns | 5 turns | 15 turns | Unlimited |\n| DOM & Vision Analysis | Yes | Yes | Yes |\n| Table & CSV Extraction | Basic | High Precision | Multi-table streaming |\n| Response Speed | Fast (1.2s) | Ultra (0.4s) | Instantaneous |`,
            message: "[Simulator Fallback] Extracted 4 rows across 4 columns from simulated table."
          });
        } else if (name === "search_tabs") {
          const q = (args.query || "").toLowerCase();
          const sampleTabs = [
            { id: 1, title: "AcceleratedLogic AI - Chrome Extension", url: "https://acceleratedlogic.ai" },
            { id: 2, title: "Google Gemini API - Developer Documentation", url: "https://ai.google.dev/docs" },
            { id: 3, title: "GitHub - AcceleratedLogic Extension Repository", url: "https://github.com/AcceleratedLogic" }
          ];
          const matched = sampleTabs.filter(t => !q || t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q));
          resolve({
            success: true,
            query: q,
            count: matched.length,
            tabs: matched,
            message: `[Simulator Fallback] Found ${matched.length} tabs matching query "${q}".`
          });
        } else if (name === "close_tab") {
          const tid = args.tabId || 1;
          resolve({
            success: true,
            tabId: tid,
            message: `[Simulator Fallback] Successfully closed tab ID ${tid}.`
          });
        } else if (name === "fill_form") {
          const fields = args.fields || [];
          resolve({
            success: true,
            fieldsFilled: fields.length,
            submitted: !!args.submitAfter,
            details: fields.map(f => ({ name: f.name || f.label || f.selector, status: "filled", value: f.value })),
            message: `[Simulator Fallback] Successfully filled ${fields.length} form field${fields.length === 1 ? '' : 's'}.`
          });
        } else if (name === "extract_media") {
          resolve({
            success: true,
            totalMedia: 6,
            imageCount: 4,
            videoCount: 1,
            docCount: 1,
            images: [
              { src: "https://acceleratedlogic.ai/logo.png", alt: "AcceleratedLogic Logo", width: 200, height: 48 },
              { src: "https://acceleratedlogic.ai/banner.webp", alt: "AI Browser Agent Banner", width: 1200, height: 630 },
              { src: "https://acceleratedlogic.ai/screenshot.png", alt: "Extension In Action", width: 800, height: 600 },
              { src: "https://acceleratedlogic.ai/avatar.jpg", alt: "User Profile", width: 96, height: 96 }
            ],
            videos: [
              { src: "https://acceleratedlogic.ai/demo.mp4", type: "video/mp4", poster: "https://acceleratedlogic.ai/demo-thumb.jpg" }
            ],
            documents: [
              { href: "https://acceleratedlogic.ai/docs/whitepaper.pdf", title: "Autonomous Browser Agent Whitepaper (PDF)", type: "pdf" }
            ],
            message: "[Simulator Fallback] Extracted 4 images, 1 video, and 1 document."
          });
        } else if (name === "compare_tabs") {
          resolve({
            success: true,
            tabA: { id: args.tabIdA || 1, title: "AcceleratedLogic AI Pro Edition", url: "https://acceleratedlogic.ai/pro", summary: "Autonomous Chrome Extension with 15-step agent loops, DOM extraction, and CSV tables." },
            tabB: { id: args.tabIdB || 2, title: "Google Gemini Developer API", url: "https://ai.google.dev", summary: "Gemini 2.5 Flash API docs, multimodal models, function calling & live streams." },
            comparisonKeyPoints: [
              "Tab 1 features Chrome extension client automation tools.",
              "Tab 2 provides the backend AI model APIs powering the extension.",
              "Both support multimodal image and tool execution workflows."
            ],
            message: `[Simulator Fallback] Successfully compared Tab ${args.tabIdA || 1} and Tab ${args.tabIdB || 2}.`
          });
        } else if (name === "tts_speak") {
          const txt = args.text || "";
          if (typeof window !== "undefined" && window.speechSynthesis) {
            try {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(txt.substring(0, 300));
              utterance.rate = args.rate || 1.0;
              utterance.pitch = args.pitch || 1.0;
              window.speechSynthesis.speak(utterance);
            } catch (e) {
              console.warn("TTS speak warning:", e);
            }
          }
          resolve({
            success: true,
            spokenTextLength: txt.length,
            message: `[Simulator Fallback] Spoke text (${txt.substring(0, 40)}...) aloud.`
          });
        } else if (name === "download_markdown_report") {
          const filename = args.filename || "research-summary.md";
          const content = args.markdownContent || "";
          try {
            const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn("Download error:", e);
          }
          resolve({
            success: true,
            filename: filename,
            bytes: content.length,
            message: `[Simulator Fallback] Downloaded Markdown report file "${filename}".`
          });
        } else if (name === "update_plan") {
          const plan = args.plan || [];
          const currIdx = args.currentStepIndex || 1;
          const activeStep = plan.find(p => p.step === currIdx) || plan[0];
          resolve({
            success: true,
            totalSteps: plan.length,
            currentStep: currIdx,
            activeGoal: activeStep?.goal || "In Progress",
            activeStatus: activeStep?.status || "in_progress",
            message: `[Simulator Fallback] Updated long-horizon plan: Step ${currIdx}/${plan.length} (${activeStep?.goal || "Milestone"}).`
          });
        } else if (name === "manage_scratchpad") {
          const act = args.action || "read";
          const key = args.key || "default";
          const content = args.content || "";
          resolve({
            success: true,
            action: act,
            key: key,
            storedLength: content.length,
            content: content || "AcceleratedLogic Agent Scratchpad: Stored intermediate facts, verified citations, and tabular data.",
            message: `[Simulator Fallback] Successfully performed scratchpad action "${act}" on key "${key}".`
          });
        } else if (name === "execute_custom_script") {
          const code = args.code || "";
          let evalResult = "Script evaluated successfully.";
          try {
            if (code.includes("querySelectorAll")) {
              evalResult = ["Feature Overview", "Autonomous Agent Architecture", "API Integration Docs", "Pricing Breakdown"];
            } else {
              evalResult = { executed: true, timestamp: Date.now(), returnVal: "OK" };
            }
          } catch (e) {
            evalResult = { error: String(e) };
          }
          resolve({
            success: true,
            result: evalResult,
            message: `[Simulator Fallback] Executed custom script safely in sandbox.`
          });
        } else if (name === "wait_for_condition") {
          const timeout = Math.min(Number(args.timeoutMs) || 1000, 4000);
          setTimeout(() => {
            resolve({
              success: true,
              conditionMet: true,
              selector: args.selector,
              textIncludes: args.textIncludes,
              elapsedMs: timeout,
              message: `[Simulator Fallback] Condition met after ${timeout}ms.`
            });
          }, Math.min(timeout, 300));
        } else if (name === "crawl_links") {
          resolve({
            success: true,
            count: 5,
            links: [
              { url: "https://acceleratedlogic.ai/docs/agent-loop", title: "Autonomous Agent Multi-Step Loop Architecture", anchorText: "Learn about Agent Loops" },
              { url: "https://acceleratedlogic.ai/docs/tools-api", title: "Comprehensive Chrome Extension Tools Reference", anchorText: "Tools API Reference" },
              { url: "https://acceleratedlogic.ai/docs/gemini-2-5", title: "Gemini 2.5 Flash & Multimodal Vision Integration", anchorText: "Gemini 2.5 Setup" },
              { url: "https://acceleratedlogic.ai/docs/scratchpad", title: "Long-Horizon Working Memory & Scratchpad Design", anchorText: "Scratchpad Docs" },
              { url: "https://acceleratedlogic.ai/pricing", title: "AcceleratedLogic Pro Tier & Cloud Options", anchorText: "View Pricing Tiers" }
            ],
            message: `[Simulator Fallback] Crawled 5 outbound and documentation links.`
          });
        } else if (name === "get_page_meta_seo") {
          resolve({
            success: true,
            title: "AcceleratedLogic AI — Autonomous Multi-Step Chrome Extension",
            description: "High-performance autonomous browser agent Chrome extension with 30-step agent loops, DOM extraction, and CSV synthesis.",
            canonical: "https://acceleratedlogic.ai",
            og: {
              "og:title": "AcceleratedLogic AI Extension",
              "og:description": "Autonomous Chrome Browser Extension with Deep Multi-Step Research",
              "og:image": "https://acceleratedlogic.ai/og-banner.png"
            },
            headingsCount: 6,
            headingsOutline: [
              { level: "h1", text: "AcceleratedLogic AI Platform" },
              { level: "h2", text: "Autonomous Agent Multi-Turn Reasoning" },
              { level: "h2", text: "Multimodal Vision & DOM Grounding" },
              { level: "h3", text: "Native Tool Declarations" },
              { level: "h3", text: "Security & Sandbox Compliance" },
              { level: "h2", text: "Get Started in Chrome" }
            ],
            jsonLdCount: 1,
            jsonLd: [{ "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "AcceleratedLogic AI" }],
            message: `[Simulator Fallback] Extracted page SEO metadata, OG tags, and 6 outline headings.`
          });
        } else {
          resolve({ error: "Unknown tool" });
        }
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          resolve({ error: "No active browser tab found." });
          return;
        }
        const activeTab = tabs[0];

        if (name === "get_page_dom") {
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              const getFrameText = (doc) => {
                let frameText = doc.body ? doc.body.innerText : "";
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                  try {
                    const subDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (subDoc) {
                      frameText += "\n--- IFRAME: " + (iframe.id || iframe.className || "untitled") + " ---\n" + getFrameText(subDoc);
                    }
                  } catch (e) {
                    // cross-origin skip
                  }
                }
                return frameText;
              };
              
              const text = getFrameText(document);
              return {
                title: document.title,
                url: window.location.href,
                text: text.substring(0, 50000)
              };
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve({
                success: true,
                title: results[0].result.title,
                url: results[0].result.url,
                text: results[0].result.text
              });
            } else {
              resolve({
                success: true,
                title: activeTab.title,
                url: activeTab.url,
                text: "Could not extract full innerText. Permission denied or scripting blocked on this system page."
              });
            }
          });
        } else if (name === "get_page_screenshot") {
          chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (screenshotUrl) => {
            if (!screenshotUrl) {
              const mockUrl = generateMockScreenshot(
                activeTab.title, 
                activeTab.url, 
                "Direct browser screen-capture restricted or forbidden on this tab. Visual fallback representation generated successfully."
              );
              resolve({
                success: true,
                screenshot_url: mockUrl,
                message: "Direct capture failed (system page). Visual mockup generated."
              });
            } else {
              resolve({
                success: true,
                screenshot_url: screenshotUrl
              });
            }
          });
        } else if (name === "click_element") {
          const sel = args.selector || "";
          const txt = args.textContext || "";
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [sel, txt],
            func: (selector, textContext) => {
              const findElements = (doc) => {
                let foundElements = [];
                if (selector) {
                  try {
                    foundElements = Array.from(doc.querySelectorAll(selector));
                  } catch (e) {}
                } else if (textContext) {
                  foundElements = Array.from(doc.querySelectorAll("button, a, input, [role='button'], span, p, div"));
                }
                
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                  try {
                    const subDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (subDoc) {
                      foundElements = foundElements.concat(findElements(subDoc));
                    }
                  } catch (e) {}
                }
                return foundElements;
              };

              let elements = findElements(document);

              if (textContext) {
                const lowerText = textContext.toLowerCase().trim();
                elements = elements.filter(el => {
                  const elText = el.textContent || el.innerText || "";
                  return elText.toLowerCase().trim().includes(lowerText);
                });
              }

              const target = elements[0];
              if (!target) {
                return { success: false, error: `Could not find element matching selector '${selector}' and text '${textContext}'` };
              }

              try {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.click();
                target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                target.focus();
                return {
                  success: true,
                  tagName: target.tagName,
                  id: target.id,
                  text: (target.textContent || target.value || "").substring(0, 100).trim(),
                  message: `Successfully clicked <${target.tagName.toLowerCase()}> element.`
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed or permission denied on this page." });
            }
          });
        } else if (name === "click_at_coordinate") {
          const x = args.x !== undefined ? args.x : null;
          const y = args.y !== undefined ? args.y : null;
          const coordType = args.coordinateType || "percentage";
          const typeText = args.typeText || "";
          const submit = !!args.submitAfter;

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [x, y, coordType, typeText, submit],
            func: async (coordX, coordY, coordinateType, textToType, submitAfter) => {
              let clientX, clientY;
              if (coordinateType === "percentage") {
                clientX = (coordX / 100) * window.innerWidth;
                clientY = (coordY / 100) * window.innerHeight;
              } else {
                clientX = coordX;
                clientY = coordY;
              }

              // Create visual indicator in active tab
              const indicator = document.createElement("div");
              indicator.style.position = "fixed";
              indicator.style.left = `${clientX - 15}px`;
              indicator.style.top = `${clientY - 15}px`;
              indicator.style.width = "30px";
              indicator.style.height = "30px";
              indicator.style.borderRadius = "50%";
              indicator.style.backgroundColor = "rgba(139, 92, 246, 0.4)"; // purple pulse
              indicator.style.border = "2px solid #a78bfa";
              indicator.style.boxShadow = "0 0 15px #8b5cf6";
              indicator.style.pointerEvents = "none";
              indicator.style.zIndex = "2147483647";
              indicator.style.transition = "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
              indicator.style.transform = "scale(0.5)";
              indicator.style.opacity = "0";
              document.body.appendChild(indicator);

              requestAnimationFrame(() => {
                indicator.style.transform = "scale(2)";
                indicator.style.opacity = "1";
                setTimeout(() => {
                  indicator.style.transform = "scale(3)";
                  indicator.style.opacity = "0";
                  setTimeout(() => { indicator.remove(); }, 800);
                }, 500);
              });

              const target = document.elementFromPoint(clientX, clientY);
              if (!target) {
                return { success: false, error: `Could not find any element at coordinates (${coordX}, ${coordY})` };
              }

              const simulateTyping = async (initialTarget, text, submit) => {
                if (!initialTarget) return;

                // 1. Give focus-shifting events a moment to settle
                await new Promise((r) => setTimeout(r, 20));

                // 2. Determine actual input/editing target
                let target = initialTarget;
                if (document.activeElement && (
                  document.activeElement.tagName === "INPUT" ||
                  document.activeElement.tagName === "TEXTAREA" ||
                  document.activeElement.isContentEditable ||
                  document.activeElement.getAttribute('role') === 'textbox' ||
                  document.activeElement.classList.contains('docs-textarea')
                )) {
                  target = document.activeElement;
                } else {
                  const docTextarea = document.querySelector('.docs-textarea');
                  if (docTextarea) {
                    target = docTextarea;
                  }
                }

                target.focus();

                // 3. Special handling for Google Docs (.docs-textarea)
                const isGoogleDocs = target.classList.contains('docs-textarea') || 
                                     window.location.hostname.includes('docs.google.com') ||
                                     document.querySelector('.docs-textarea') !== null;

                if (isGoogleDocs) {
                  try {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.setData('text/plain', text);
                    const pasteEvent = new ClipboardEvent('paste', {
                      bubbles: true,
                      cancelable: true,
                      clipboardData: dataTransfer
                    });
                    target.dispatchEvent(pasteEvent);
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                    if (submit) {
                      const activeEl = document.activeElement || target;
                      activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    }
                    return;
                  } catch (err) {}
                }

                // 4. Character by character typing fallback
                for (let i = 0; i < text.length; i++) {
                  const char = text[i];
                  const charCode = char.charCodeAt(0);
                  const keyCode = char.toUpperCase().charCodeAt(0);

                  // Keydown
                  const keydownEvent = new KeyboardEvent('keydown', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keydownEvent);

                  // BeforeInput
                  let beforeInputAllowed = true;
                  try {
                    const beforeInputEvent = new InputEvent('beforeinput', {
                      bubbles: true,
                      cancelable: true,
                      inputType: 'insertText',
                      data: char
                    });
                    beforeInputAllowed = target.dispatchEvent(beforeInputEvent);
                  } catch (e) {}

                  if (beforeInputAllowed) {
                    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
                      const start = target.selectionStart || 0;
                      const end = target.selectionEnd || 0;
                      const oldVal = target.value;
                      const newVal = oldVal.substring(0, start) + char + oldVal.substring(end);
                      
                      const prototype = Object.getPrototypeOf(target);
                      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                      if (setter) {
                        setter.call(target, newVal);
                      } else {
                        target.value = newVal;
                      }
                      target.selectionStart = target.selectionEnd = start + 1;
                    } else {
                      const targetEditable = target.isContentEditable ? target : (
                        target.querySelector('[contenteditable="true"]') ||
                        target.querySelector('.ql-editor') ||
                        target.querySelector('.public-DraftEditor-content') ||
                        target.querySelector('.ProseMirror') ||
                        target.querySelector('[role="textbox"]')
                      );

                      if (targetEditable) {
                        targetEditable.focus();
                        
                        let textEventHandled = false;
                        try {
                          const textEvent = document.createEvent('TextEvent');
                          textEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
                          textEventHandled = targetEditable.dispatchEvent(textEvent);
                        } catch (e) {}

                        if (!textEventHandled) {
                          try {
                            const selection = window.getSelection();
                            if (selection && selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0);
                              range.deleteContents();
                              const textNode = document.createTextNode(char);
                              range.insertNode(textNode);
                              range.setStartAfter(textNode);
                              range.setEndAfter(textNode);
                              selection.removeAllRanges();
                              selection.addRange(range);
                            } else {
                              document.execCommand('insertText', false, char);
                            }
                          } catch (err) {
                            try {
                              document.execCommand('insertText', false, char);
                            } catch (e2) {
                              targetEditable.innerText += char;
                            }
                          }
                        }
                      } else {
                        try {
                          const textEvent = document.createEvent('TextEvent');
                          textEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
                          target.dispatchEvent(textEvent);
                        } catch (e) {}

                        try {
                          document.execCommand('insertText', false, char);
                        } catch (err) {
                          target.innerText += char;
                        }
                      }
                    }

                    // Input
                    try {
                      const inputEvent = new InputEvent('input', {
                        bubbles: true,
                        inputType: 'insertText',
                        data: char
                      });
                      target.dispatchEvent(inputEvent);
                    } catch (e) {
                      target.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }

                  // Keypress
                  const keypressEvent = new KeyboardEvent('keypress', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: charCode,
                    which: charCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keypressEvent);

                  // Keyup
                  const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keyupEvent);

                  await new Promise((r) => setTimeout(r, 10));
                }

                target.dispatchEvent(new Event('change', { bubbles: true }));

                if (submit) {
                  const form = target.form || (target.closest ? target.closest('form') : null);
                  if (form) {
                    if (form.requestSubmit) form.requestSubmit();
                    else form.submit();
                  } else {
                    const activeEl = document.activeElement || target;
                    activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                  }
                }
              };

              try {
                target.focus();
                target.click();
                target.dispatchEvent(new MouseEvent('mousedown', { clientX, clientY, bubbles: true }));
                target.dispatchEvent(new MouseEvent('mouseup', { clientX, clientY, bubbles: true }));

                let hasTyped = false;
                if (textToType) {
                  await simulateTyping(target, textToType, submitAfter);
                  hasTyped = true;
                }

                return {
                  success: true,
                  tagName: target.tagName,
                  id: target.id,
                  textAtCoordinate: (target.textContent || target.value || "").substring(0, 100).trim(),
                  typed: hasTyped ? textToType : null,
                  message: `Successfully clicked at coordinate (${coordX}, ${coordY}) targeting <${target.tagName.toLowerCase()}>.`
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed or permission denied on this page." });
            }
          });
        } else if (name === "type_text") {
          const sel = args.selector || "";
          const txt = args.text || "";
          const submit = !!args.submitAfter;
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [sel, txt, submit],
            func: async (selector, text, submitAfter) => {
              const findElementInAllFrames = (selector, doc = document) => {
                try {
                  const found = doc.querySelector(selector);
                  if (found) return found;
                } catch (e) {}
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                  try {
                    const subDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (subDoc) {
                      const found = findElementInAllFrames(selector, subDoc);
                      if (found) return found;
                    }
                  } catch (e) {}
                }
                return null;
              };

              const getDeepActiveElement = (doc = document) => {
                let el = doc.activeElement;
                while (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) {
                  try {
                    const subDoc = el.contentDocument || el.contentWindow.document;
                    if (subDoc && subDoc.activeElement && subDoc.activeElement !== el) {
                      el = subDoc.activeElement;
                    } else {
                      break;
                    }
                  } catch (e) {
                    break;
                  }
                }
                return el;
              };

              let target;
              try {
                target = findElementInAllFrames(selector, document);
              } catch (e) {
                return { success: false, error: "Invalid selector: " + selector };
              }

              if (!target) {
                return { success: false, error: `Could not find input element matching selector '${selector}'` };
              }

              const simulateTyping = async (initialTarget, text, submit) => {
                if (!initialTarget) return;

                // 1. Give focus-shifting events a moment to settle
                await new Promise((r) => setTimeout(r, 20));

                // 2. Determine actual input/editing target
                let target = initialTarget;
                const activeEl = getDeepActiveElement(document);
                if (activeEl && (
                  activeEl.tagName === "INPUT" ||
                  activeEl.tagName === "TEXTAREA" ||
                  activeEl.isContentEditable ||
                  activeEl.getAttribute('role') === 'textbox' ||
                  activeEl.classList.contains('docs-textarea')
                )) {
                  target = activeEl;
                } else {
                  const docTextarea = findElementInAllFrames('.docs-textarea', document);
                  if (docTextarea) {
                    target = docTextarea;
                  }
                }

                target.focus();

                const win = target.ownerDocument ? (target.ownerDocument.defaultView || window) : window;

                // 3. Special handling for Google Docs (.docs-textarea)
                const isGoogleDocs = target.classList.contains('docs-textarea') || 
                                     win.location.hostname.includes('docs.google.com') ||
                                     findElementInAllFrames('.docs-textarea', document) !== null;

                if (isGoogleDocs) {
                  try {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.setData('text/plain', text);
                    const pasteEvent = new ClipboardEvent('paste', {
                      bubbles: true,
                      cancelable: true,
                      clipboardData: dataTransfer
                    });
                    target.dispatchEvent(pasteEvent);
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                    if (submit) {
                      const activeEl = getDeepActiveElement(document) || target;
                      activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    }
                    return;
                  } catch (err) {}
                }

                // 4. Character by character typing fallback
                for (let i = 0; i < text.length; i++) {
                  const char = text[i];
                  const charCode = char.charCodeAt(0);
                  const keyCode = char.toUpperCase().charCodeAt(0);

                  // Keydown
                  const keydownEvent = new KeyboardEvent('keydown', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keydownEvent);

                  // BeforeInput
                  let beforeInputAllowed = true;
                  try {
                    const beforeInputEvent = new InputEvent('beforeinput', {
                      bubbles: true,
                      cancelable: true,
                      inputType: 'insertText',
                      data: char
                    });
                    beforeInputAllowed = target.dispatchEvent(beforeInputEvent);
                  } catch (e) {}

                  if (beforeInputAllowed) {
                    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
                      const start = target.selectionStart || 0;
                      const end = target.selectionEnd || 0;
                      const oldVal = target.value;
                      const newVal = oldVal.substring(0, start) + char + oldVal.substring(end);
                      
                      const prototype = Object.getPrototypeOf(target);
                      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                      if (setter) {
                        setter.call(target, newVal);
                      } else {
                        target.value = newVal;
                      }
                      target.selectionStart = target.selectionEnd = start + 1;
                    } else {
                      const targetEditable = target.isContentEditable ? target : (
                        target.querySelector('[contenteditable="true"]') ||
                        target.querySelector('.ql-editor') ||
                        target.querySelector('.public-DraftEditor-content') ||
                        target.querySelector('.ProseMirror') ||
                        target.querySelector('[role="textbox"]')
                      );

                      if (targetEditable) {
                        targetEditable.focus();
                        
                        let textEventHandled = false;
                        try {
                          const textEvent = win.document.createEvent('TextEvent');
                          textEvent.initTextEvent('textInput', true, true, win, char, 0, 'en-US');
                          textEventHandled = targetEditable.dispatchEvent(textEvent);
                        } catch (e) {}

                        if (!textEventHandled) {
                          try {
                            const selection = win.getSelection();
                            if (selection && selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0);
                              range.deleteContents();
                              const textNode = win.document.createTextNode(char);
                              range.insertNode(textNode);
                              range.setStartAfter(textNode);
                              range.setEndAfter(textNode);
                              selection.removeAllRanges();
                              selection.addRange(range);
                            } else {
                              win.document.execCommand('insertText', false, char);
                            }
                          } catch (err) {
                            try {
                              win.document.execCommand('insertText', false, char);
                            } catch (e2) {
                              targetEditable.innerText += char;
                            }
                          }
                        }
                      } else {
                        try {
                          const textEvent = win.document.createEvent('TextEvent');
                          textEvent.initTextEvent('textInput', true, true, win, char, 0, 'en-US');
                          target.dispatchEvent(textEvent);
                        } catch (e) {}

                        try {
                          win.document.execCommand('insertText', false, char);
                        } catch (err) {
                          target.innerText += char;
                        }
                      }
                    }

                    // Input
                    try {
                      const inputEvent = new InputEvent('input', {
                        bubbles: true,
                        inputType: 'insertText',
                        data: char
                      });
                      target.dispatchEvent(inputEvent);
                    } catch (e) {
                      target.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }

                  // Keypress
                  const keypressEvent = new KeyboardEvent('keypress', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: charCode,
                    which: charCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keypressEvent);

                  // Keyup
                  const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keyupEvent);

                  await new Promise((r) => setTimeout(r, 10));
                }

                target.dispatchEvent(new Event('change', { bubbles: true }));

                if (submit) {
                  const form = target.form || (target.closest ? target.closest('form') : null);
                  if (form) {
                    if (form.requestSubmit) form.requestSubmit();
                    else form.submit();
                  } else {
                    const activeEl = getDeepActiveElement(document) || target;
                    activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                  }
                }
              };

              try {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.focus();

                await simulateTyping(target, text, submitAfter);

                return {
                  success: true,
                  tagName: target.tagName,
                  id: target.id,
                  textTyped: text,
                  submitted: submitAfter,
                  message: `Successfully typed "${text}" into <${target.tagName.toLowerCase()}> element.`
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed or permission denied on this page." });
            }
          });
        } else if (name === "scroll_page") {
          const dir = args.direction || "down";
          const amt = args.amount !== undefined ? args.amount : null;
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [dir, amt],
            func: async (direction, amount) => {
              const getScrollableElements = () => {
                const elems = Array.from(document.querySelectorAll('*'));
                return elems.filter(el => {
                  const style = window.getComputedStyle(el);
                  const isScrollableY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
                  const isScrollableX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
                  return (isScrollableY || isScrollableX) && el.getBoundingClientRect().height > 50;
                });
              };

              let target = window;
              let isWindow = true;

              const getMetrics = () => {
                let scrollTop = 0;
                let scrollLeft = 0;
                let scrollHeight = 0;
                let scrollWidth = 0;
                let clientHeight = 0;
                let clientWidth = 0;

                if (isWindow) {
                  scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
                  scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
                  scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                  scrollWidth = document.documentElement.scrollWidth || document.body.scrollWidth;
                  clientHeight = window.innerHeight || document.documentElement.clientHeight;
                  clientWidth = window.innerWidth || document.documentElement.clientWidth;
                } else {
                  const el = target;
                  scrollTop = el.scrollTop;
                  scrollLeft = el.scrollLeft;
                  scrollHeight = el.scrollHeight;
                  scrollWidth = el.scrollWidth;
                  clientHeight = el.clientHeight;
                  clientWidth = el.clientWidth;
                }

                const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
                const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
                return {
                  scrollTop,
                  scrollLeft,
                  scrollHeight,
                  scrollWidth,
                  clientHeight,
                  clientWidth,
                  maxScrollTop,
                  maxScrollLeft,
                  isAtTop: scrollTop <= 5,
                  isAtBottom: scrollTop >= maxScrollTop - 5
                };
              };

              let metricsBefore = getMetrics();
              const scrollAmt = amount || Math.round(metricsBefore.clientHeight * 0.75);
              let scrollX = 0;
              let scrollY = 0;
              if (direction === "down") scrollY = scrollAmt;
              else if (direction === "up") scrollY = -scrollAmt;
              else if (direction === "right") scrollX = scrollAmt;
              else if (direction === "left") scrollX = -scrollAmt;

              // Apply scroll on window
              window.scrollBy({ left: scrollX, top: scrollY, behavior: 'smooth' });
              await new Promise(r => setTimeout(r, 350));
              
              let metricsAfter = getMetrics();

              // If window didn't scroll vertically and we aren't at the limit, find a custom scroll container
              if (scrollY !== 0 && Math.abs(metricsAfter.scrollTop - metricsBefore.scrollTop) < 5 && !metricsBefore.isAtBottom && !metricsBefore.isAtTop) {
                const scrollables = getScrollableElements();
                if (scrollables.length > 0) {
                  scrollables.sort((a, b) => b.scrollHeight - a.scrollHeight);
                  target = scrollables[0];
                  isWindow = false;
                  
                  metricsBefore = getMetrics();
                  target.scrollBy({ left: 0, top: scrollY, behavior: 'smooth' });
                  await new Promise(r => setTimeout(r, 350));
                  metricsAfter = getMetrics();
                }
              }

              // Try horizontal scroll container if needed
              if (scrollX !== 0 && Math.abs(metricsAfter.scrollLeft - metricsBefore.scrollLeft) < 5 && !metricsBefore.isAtBottom && !metricsBefore.isAtTop) {
                const scrollables = getScrollableElements();
                if (scrollables.length > 0) {
                  scrollables.sort((a, b) => b.scrollWidth - a.scrollWidth);
                  target = scrollables[0];
                  isWindow = false;
                  
                  metricsBefore = getMetrics();
                  target.scrollBy({ left: scrollX, top: 0, behavior: 'smooth' });
                  await new Promise(r => setTimeout(r, 350));
                  metricsAfter = getMetrics();
                }
              }

              return {
                success: true,
                message: `Successfully scrolled ${direction} by ${scrollAmt}px.`,
                scrollPosition: {
                  scrollTop: Math.round(metricsAfter.scrollTop),
                  scrollLeft: Math.round(metricsAfter.scrollLeft),
                  maxScrollTop: Math.round(metricsAfter.maxScrollTop),
                  maxScrollLeft: Math.round(metricsAfter.maxScrollLeft),
                  isAtTop: metricsAfter.scrollTop <= 5,
                  isAtBottom: metricsAfter.scrollTop >= metricsAfter.maxScrollTop - 5,
                  scrollPercentage: metricsAfter.maxScrollTop > 0 ? Math.round((metricsAfter.scrollTop / metricsAfter.maxScrollTop) * 100) : 0
                }
              };
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed for scrolling." });
            }
          });
        } else if (name === "open_tab") {
          const url = args.url;
          chrome.tabs.create({ url: url }, (tab) => {
            resolve({
              success: true,
              tabId: tab.id,
              url: tab.url,
              message: `Successfully opened new tab with URL: ${url}`
            });
          });
        } else if (name === "wait") {
          const delay = Number(args.delayMs) || 1000;
          setTimeout(() => {
            resolve({
              success: true,
              delayMs: delay,
              message: `Successfully waited/slept for ${delay}ms.`
            });
          }, delay);
        } else if (name === "search_web") {
          const query = args.query;
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          chrome.tabs.create({ url: searchUrl }, (tab) => {
            resolve({
              success: true,
              tabId: tab.id,
              query: query,
              message: `Successfully performed web search for "${query}" and opened search tab.`
            });
          });
        } else if (name === "list_tabs") {
          chrome.tabs.query({ currentWindow: true }, (tabsList) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve({
                success: true,
                tabs: (tabsList || []).map(t => ({
                  id: t.id,
                  title: t.title,
                  url: t.url,
                  active: t.active
                }))
              });
            }
          });
        } else if (name === "switch_tab") {
          const targetId = Number(args.tabId);
          chrome.tabs.update(targetId, { active: true }, (tab) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve({
                success: true,
                tabId: targetId,
                title: tab ? tab.title : "",
                url: tab ? tab.url : "",
                message: `Successfully switched active tab to: ${tab ? tab.title : targetId}`
              });
            }
          });
        } else if (name === "press_key") {
          const key = args.key || "";
          const selector = args.selector || "";
          const holdDuration = args.holdDuration !== undefined ? Number(args.holdDuration) : 50;
          const ctrlKey = !!args.ctrlKey;
          const altKey = !!args.altKey;
          const shiftKey = !!args.shiftKey;
          const metaKey = !!args.metaKey;

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [key, selector, holdDuration, ctrlKey, altKey, shiftKey, metaKey],
            func: async (keyVal, sel, duration, ctrl, alt, shift, meta) => {
              const findElementInAllFrames = (selector, doc = document) => {
                try {
                  const found = doc.querySelector(selector);
                  if (found) return found;
                } catch (e) {}
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                  try {
                    const subDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (subDoc) {
                      const found = findElementInAllFrames(selector, subDoc);
                      if (found) return found;
                    }
                  } catch (e) {}
                }
                return null;
              };

              const getDeepActiveElement = (doc = document) => {
                let el = doc.activeElement;
                while (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) {
                  try {
                    const subDoc = el.contentDocument || el.contentWindow.document;
                    if (subDoc && subDoc.activeElement && subDoc.activeElement !== el) {
                      el = subDoc.activeElement;
                    } else {
                      break;
                    }
                  } catch (e) {
                    break;
                  }
                }
                return el;
              };

              let target = getDeepActiveElement(document) || document.body;
              if (sel) {
                const found = findElementInAllFrames(sel, document);
                if (found) {
                  target = found;
                  target.focus();
                }
              }

              let keyName = keyVal;
              let codeName = keyVal;
              let keyCodeNum = 0;
              const lowerKey = keyVal.toLowerCase();

              if (keyVal.length === 1 && keyVal.match(/[a-zA-Z]/)) {
                const upper = keyVal.toUpperCase();
                codeName = 'Key' + upper;
                keyCodeNum = upper.charCodeAt(0);
              } else if (keyVal.length === 1 && keyVal.match(/[0-9]/)) {
                codeName = 'Digit' + keyVal;
                keyCodeNum = keyVal.charCodeAt(0);
              } else if (keyVal === 'ArrowUp') { codeName = 'ArrowUp'; keyCodeNum = 38; }
              else if (keyVal === 'ArrowDown') { codeName = 'ArrowDown'; keyCodeNum = 40; }
              else if (keyVal === 'ArrowLeft') { codeName = 'ArrowLeft'; keyCodeNum = 37; }
              else if (keyVal === 'ArrowRight') { codeName = 'ArrowRight'; keyCodeNum = 39; }
              else if (keyVal === 'Enter') { codeName = 'Enter'; keyCodeNum = 13; }
              else if (keyVal === 'Space' || keyVal === ' ') { keyName = ' '; codeName = 'Space'; keyCodeNum = 32; }
              else if (keyVal === 'Escape') { codeName = 'Escape'; keyCodeNum = 27; }
              else if (keyVal === 'Backspace') { codeName = 'Backspace'; keyCodeNum = 8; }
              else if (keyVal === 'Tab') { codeName = 'Tab'; keyCodeNum = 9; }
              else {
                keyCodeNum = keyVal.charCodeAt(0) || 0;
              }

              const commonConfig = {
                key: keyName,
                code: codeName,
                keyCode: keyCodeNum,
                which: keyCodeNum,
                bubbles: true,
                cancelable: true,
                ctrlKey: ctrl,
                altKey: alt,
                shiftKey: shift,
                metaKey: meta
              };

              const downEvent = new KeyboardEvent('keydown', commonConfig);
              target.dispatchEvent(downEvent);

              if (keyName.length === 1) {
                const pressEvent = new KeyboardEvent('keypress', commonConfig);
                target.dispatchEvent(pressEvent);
              }

              if (duration > 0) {
                await new Promise(r => setTimeout(r, duration));
              }

              const upEvent = new KeyboardEvent('keyup', commonConfig);
              target.dispatchEvent(upEvent);

              return {
                success: true,
                message: `Successfully pressed key "${keyVal}" on element <${target.tagName.toLowerCase()}>${sel ? " matching selector: " + sel : ""}.`
              };
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed for key press simulation." });
            }
          });
        } else if (name === "select_text") {
          const searchText = args.searchText || "";
          const selector = args.selector || "";
          const startIndex = args.startIndex !== undefined ? Number(args.startIndex) : null;
          const endIndex = args.endIndex !== undefined ? Number(args.endIndex) : null;

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [searchText, selector, startIndex, endIndex],
            func: async (searchTextVal, sel, startIdx, endIdx) => {
              const findElementInAllFrames = (selector, doc = document) => {
                try {
                  const found = doc.querySelector(selector);
                  if (found) return found;
                } catch (e) {}
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                  try {
                    const subDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (subDoc) {
                      const found = findElementInAllFrames(selector, subDoc);
                      if (found) return found;
                    }
                  } catch (e) {}
                }
                return null;
              };

              const getDeepActiveElement = (doc = document) => {
                let el = doc.activeElement;
                while (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) {
                  try {
                    const subDoc = el.contentDocument || el.contentWindow.document;
                    if (subDoc && subDoc.activeElement && subDoc.activeElement !== el) {
                      el = subDoc.activeElement;
                    } else {
                      break;
                    }
                  } catch (e) {
                    break;
                  }
                }
                return el;
              };

              let target = getDeepActiveElement(document) || document.body;
              if (sel) {
                const found = findElementInAllFrames(sel, document);
                if (found) target = found;
              }

              const win = target.ownerDocument ? (target.ownerDocument.defaultView || window) : window;

              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                target.focus();
                const val = target.value || "";
                let s = 0;
                let e = val.length;

                if (startIdx !== null && endIdx !== null) {
                  s = startIdx;
                  e = endIdx;
                } else if (searchTextVal) {
                  const idx = val.toLowerCase().indexOf(searchTextVal.toLowerCase());
                  if (idx !== -1) {
                    s = idx;
                    e = idx + searchTextVal.length;
                  }
                }

                target.setSelectionRange(s, e);
                return {
                  success: true,
                  tagName: target.tagName,
                  message: `Successfully selected text range [${s}, ${e}] in input/textarea.`
                };
              }

              target.focus();
              const selection = win.getSelection();
              if (!selection) {
                return { success: false, error: "Selection API not available in this window context." };
              }
              selection.removeAllRanges();

              if (searchTextVal) {
                const walker = win.document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
                let textNode = null;
                let offset = -1;

                while (walker.nextNode()) {
                  const node = walker.currentNode;
                  const idx = (node.nodeValue || "").toLowerCase().indexOf(searchTextVal.toLowerCase());
                  if (idx !== -1) {
                    textNode = node;
                    offset = idx;
                    break;
                  }
                }

                if (textNode) {
                  const range = win.document.createRange();
                  range.setStart(textNode, offset);
                  range.setEnd(textNode, offset + searchTextVal.length);
                  selection.addRange(range);

                  try {
                    textNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } catch (err) {}

                  return {
                    success: true,
                    message: `Successfully highlighted and selected text "${searchTextVal}".`
                  };
                } else {
                  if (typeof win.find === 'function') {
                    const found = win.find(searchTextVal, false, false, true, false, true, false);
                    if (found) {
                      return {
                        success: true,
                        message: `Successfully selected text "${searchTextVal}" via window.find.`
                      };
                    }
                  }
                  return {
                    success: false,
                    error: `Could not find text "${searchTextVal}" inside the target.`
                  };
                }
              } else {
                const range = win.document.createRange();
                range.selectNodeContents(target);
                selection.addRange(range);
                return {
                  success: true,
                  message: `Successfully selected all contents of element <${target.tagName.toLowerCase()}>.`
                };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed for select_text." });
            }
          });
        } else if (name === "replace_text") {
          const searchText = args.searchText || "";
          const replaceText = args.replaceText || "";
          const selector = args.selector || "";

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [searchText, replaceText, selector],
            func: async (searchVal, replaceVal, sel) => {
              const findElementInAllFrames = (selector, doc = document) => {
                try {
                  const found = doc.querySelector(selector);
                  if (found) return found;
                } catch (e) {}
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                  try {
                    const subDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (subDoc) {
                      const found = findElementInAllFrames(selector, subDoc);
                      if (found) return found;
                    }
                  } catch (e) {}
                }
                return null;
              };

              const getDeepActiveElement = (doc = document) => {
                let el = doc.activeElement;
                while (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) {
                  try {
                    const subDoc = el.contentDocument || el.contentWindow.document;
                    if (subDoc && subDoc.activeElement && subDoc.activeElement !== el) {
                      el = subDoc.activeElement;
                    } else {
                      break;
                    }
                  } catch (e) {
                    break;
                  }
                }
                return el;
              };

              let target = getDeepActiveElement(document) || document.body;
              if (sel) {
                const found = findElementInAllFrames(sel, document);
                if (found) {
                  target = found;
                  target.focus();
                }
              }

              const win = target.ownerDocument ? (target.ownerDocument.defaultView || window) : window;

              const isGoogleDocs = target.classList.contains('docs-textarea') || 
                                   win.location.hostname.includes('docs.google.com') ||
                                   findElementInAllFrames('.docs-textarea', document) !== null;

              if (isGoogleDocs) {
                const docsTextarea = findElementInAllFrames('.docs-textarea', document) || target;
                docsTextarea.focus();
                try {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.setData('text/plain', replaceVal);
                  const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                  });
                  docsTextarea.dispatchEvent(pasteEvent);
                  docsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                  return {
                    success: true,
                    message: `Successfully replaced selection with "${replaceVal}" in Google Docs via clipboard simulation.`
                  };
                } catch (e) {
                  return { success: false, error: "Failed to paste in Google Docs: " + e.message };
                }
              }

              if (searchVal) {
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                  const val = target.value || "";
                  const idx = val.toLowerCase().indexOf(searchVal.toLowerCase());
                  if (idx !== -1) {
                    target.setSelectionRange(idx, idx + searchVal.length);
                  } else {
                    return { success: false, error: `Could not find text "${searchVal}" inside input/textarea.` };
                  }
                } else {
                  const selection = win.getSelection();
                  if (selection) {
                    selection.removeAllRanges();
                    const walker = win.document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
                    let textNode = null;
                    let offset = -1;

                    while (walker.nextNode()) {
                      const node = walker.currentNode;
                      const idx = (node.nodeValue || "").toLowerCase().indexOf(searchVal.toLowerCase());
                      if (idx !== -1) {
                        textNode = node;
                        offset = idx;
                        break;
                      }
                    }

                    if (textNode) {
                      const range = win.document.createRange();
                      range.setStart(textNode, offset);
                      range.setEnd(textNode, offset + searchVal.length);
                      selection.addRange(range);
                    } else if (typeof win.find === 'function') {
                      win.find(searchVal, false, false, true, false, true, false);
                    } else {
                      return { success: false, error: `Could not find text "${searchVal}" on page.` };
                    }
                  }
                }
              }

              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                const start = target.selectionStart || 0;
                const end = target.selectionEnd || 0;
                const val = target.value;
                
                target.value = val.substring(0, start) + replaceVal + val.substring(end);
                target.selectionStart = target.selectionEnd = start + replaceVal.length;
                
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));

                return {
                  success: true,
                  message: `Successfully replaced text with "${replaceVal}" in input/textarea.`
                };
              }

              try {
                const selection = win.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const executed = win.document.execCommand('insertText', false, replaceVal);
                  if (executed) {
                    return {
                      success: true,
                      message: `Successfully replaced text selection with "${replaceVal}" using document.execCommand.`
                    };
                  }
                }
              } catch (e) {}

              if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
                const selection = win.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.deleteContents();
                  const textNode = win.document.createTextNode(replaceVal);
                  range.insertNode(textNode);
                  range.collapse(false);
                  
                  target.dispatchEvent(new Event('input', { bubbles: true }));
                  return {
                    success: true,
                    message: `Successfully replaced selection with "${replaceVal}" via manual Range DOM manipulation.`
                  };
                }
              }

              return {
                success: false,
                error: "No active selection found and could not perform replacement. Make sure the text is selected/highlighted first."
              };
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Script injection failed for replace_text." });
            }
          });
        } else if (name === "extract_links") {
          const keyword = args.keyword || "";
          const selector = args.selector || "";

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [keyword, selector],
            func: (kw, sel) => {
              try {
                const root = sel ? (document.querySelector(sel) || document) : document;
                const anchors = Array.from(root.querySelectorAll('a[href]'));
                let results = anchors.map(a => ({
                  href: a.href,
                  text: (a.innerText || a.textContent || '').trim(),
                  title: a.title || ''
                })).filter(i => i.href && !i.href.startsWith('javascript:'));

                if (kw) {
                  const kwLower = kw.toLowerCase();
                  results = results.filter(i => i.href.toLowerCase().includes(kwLower) || i.text.toLowerCase().includes(kwLower) || i.title.toLowerCase().includes(kwLower));
                }

                return {
                  success: true,
                  count: results.length,
                  links: results.slice(0, 50)
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Failed to extract links from tab." });
            }
          });
        } else if (name === "execute_script") {
          const codeStr = args.code || "";

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [codeStr],
            func: (codeToEval) => {
              try {
                const res = eval(codeToEval);
                return {
                  success: true,
                  result: typeof res === 'object' ? JSON.stringify(res) : String(res)
                };
              } catch (e) {
                return { success: false, error: "Script execution error: " + e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Failed to execute script on tab." });
            }
          });
        } else if (name === "go_back_forward") {
          const dir = args.direction || "back";

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [dir],
            func: (direction) => {
              try {
                if (direction === "forward") {
                  history.forward();
                } else {
                  history.back();
                }
                return { success: true, direction };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Failed to navigate history." });
            }
          });
        } else if (name === "get_element_details") {
          const selector = args.selector || "";
          const textContext = args.textContext || "";

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [selector, textContext],
            func: (sel, textCtx) => {
              try {
                let el = document.querySelector(sel);
                if (textCtx && sel) {
                  const matches = Array.from(document.querySelectorAll(sel));
                  const found = matches.find(m => (m.innerText || '').toLowerCase().includes(textCtx.toLowerCase()));
                  if (found) el = found;
                }
                if (!el) return { success: false, error: `Element matching selector "${sel}" not found.` };

                const rect = el.getBoundingClientRect();
                const attrs = {};
                for (let a of el.attributes) {
                  attrs[a.name] = a.value;
                }

                return {
                  success: true,
                  tagName: el.tagName,
                  id: el.id,
                  className: el.className,
                  rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
                  textContent: (el.textContent || '').trim().slice(0, 500),
                  attributes: attrs,
                  isVisible: rect.width > 0 && rect.height > 0
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Failed to inspect element." });
            }
          });
        } else if (name === "highlight_element") {
          const selector = args.selector || "";
          const color = args.color || "#8b5cf6";
          const duration = args.durationMs !== undefined ? Number(args.durationMs) : 4000;
          const label = args.label || "";
          const scrollIntoView = args.scrollIntoView !== false;

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [selector, color, duration, label, scrollIntoView],
            func: (sel, hlColor, dur, lbl, autoScroll) => {
              try {
                const el = document.querySelector(sel);
                if (!el) return { success: false, error: `Element matching selector "${sel}" not found.` };

                if (autoScroll) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }

                const rect = el.getBoundingClientRect();
                const overlay = document.createElement("div");
                overlay.className = "accelerated-logic-highlight-overlay";
                overlay.style.position = "fixed";
                overlay.style.left = `${Math.max(0, rect.left - 4)}px`;
                overlay.style.top = `${Math.max(0, rect.top - 4)}px`;
                overlay.style.width = `${rect.width + 8}px`;
                overlay.style.height = `${rect.height + 8}px`;
                overlay.style.border = `3px solid ${hlColor}`;
                overlay.style.borderRadius = "8px";
                overlay.style.boxShadow = `0 0 20px ${hlColor}, inset 0 0 10px ${hlColor}33`;
                overlay.style.backgroundColor = `${hlColor}18`;
                overlay.style.pointerEvents = "none";
                overlay.style.zIndex = "2147483646";
                overlay.style.transition = "all 0.3s ease";
                overlay.style.boxSizing = "border-box";

                if (lbl) {
                  const badge = document.createElement("div");
                  badge.style.position = "absolute";
                  badge.style.top = "-26px";
                  badge.style.left = "0";
                  badge.style.backgroundColor = hlColor;
                  badge.style.color = "#ffffff";
                  badge.style.fontSize = "11px";
                  badge.style.fontWeight = "600";
                  badge.style.fontFamily = "system-ui, sans-serif";
                  badge.style.padding = "2px 8px";
                  badge.style.borderRadius = "4px";
                  badge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
                  badge.style.whiteSpace = "nowrap";
                  badge.textContent = lbl;
                  overlay.appendChild(badge);
                }

                document.body.appendChild(overlay);

                if (dur > 0) {
                  setTimeout(() => {
                    overlay.style.opacity = "0";
                    setTimeout(() => overlay.remove(), 400);
                  }, dur);
                }

                return {
                  success: true,
                  tagName: el.tagName,
                  id: el.id,
                  selector: sel,
                  label: lbl || undefined,
                  rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
                  message: `Successfully highlighted element <${el.tagName.toLowerCase()}> with ${hlColor} border.`
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Failed to highlight element on tab." });
            }
          });
        } else if (name === "extract_table_data") {
          const selector = args.selector || "";
          const format = args.format || "json";
          const maxRows = Number(args.maxRows) || 100;

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [selector, format, maxRows],
            func: (sel, outFormat, maxR) => {
              try {
                let tables = [];
                if (sel) {
                  const custom = document.querySelectorAll(sel);
                  if (custom.length > 0) tables = Array.from(custom);
                }
                if (tables.length === 0) {
                  tables = Array.from(document.querySelectorAll("table, [role='table'], [role='grid']"));
                }

                if (tables.length === 0) {
                  return {
                    success: false,
                    error: "No table or grid elements found on the page."
                  };
                }

                const extractedTables = [];

                tables.forEach((table, tIndex) => {
                  const headers = [];
                  const rows = [];

                  // 1. Extract Headers
                  const headerEls = table.querySelectorAll("thead th, tr:first-child th, thead td, [role='columnheader']");
                  if (headerEls.length > 0) {
                    headerEls.forEach(th => {
                      const txt = (th.innerText || th.textContent || "").trim().replace(/\s+/g, ' ');
                      headers.push(txt || `Column ${headers.length + 1}`);
                    });
                  }

                  // 2. Extract Data Rows
                  const rowEls = table.querySelectorAll("tbody tr, tr:not(:first-child), [role='row']");
                  const targetRowEls = rowEls.length > 0 ? Array.from(rowEls) : Array.from(table.querySelectorAll("tr"));

                  targetRowEls.slice(0, maxR).forEach((tr) => {
                    const cells = Array.from(tr.querySelectorAll("td, th, [role='cell'], [role='gridcell']"));
                    if (cells.length === 0) return;

                    const rowObj = {};
                    const rowArr = [];

                    cells.forEach((td, cIdx) => {
                      const val = (td.innerText || td.textContent || "").trim().replace(/\s+/g, ' ');
                      const colName = headers[cIdx] || `Col_${cIdx + 1}`;
                      rowObj[colName] = val;
                      rowArr.push(val);
                    });

                    if (headers.length === 0 && rowArr.length > 0) {
                      rowArr.forEach((_, idx) => headers.push(`Col_${idx + 1}`));
                    }

                    rows.push(rowObj);
                  });

                  let csvStr = "";
                  if (headers.length > 0) {
                    csvStr += headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(",") + "\n";
                    rows.forEach(r => {
                      csvStr += headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(",") + "\n";
                    });
                  }

                  let mdStr = "";
                  if (headers.length > 0) {
                    mdStr += "| " + headers.join(" | ") + " |\n";
                    mdStr += "| " + headers.map(() => "---").join(" | ") + " |\n";
                    rows.forEach(r => {
                      mdStr += "| " + headers.map(h => (r[h] || '').replace(/\|/g, '\\|')).join(" | ") + " |\n";
                    });
                  }

                  extractedTables.push({
                    tableIndex: tIndex + 1,
                    headers,
                    rowCount: rows.length,
                    data: rows,
                    csv: csvStr,
                    markdown: mdStr
                  });
                });

                const primary = extractedTables[0];
                return {
                  success: true,
                  tableCount: extractedTables.length,
                  headers: primary.headers,
                  rowCount: primary.rowCount,
                  data: primary.data,
                  csv: primary.csv,
                  markdown: primary.markdown,
                  allTables: extractedTables.length > 1 ? extractedTables : undefined,
                  message: `Successfully extracted ${primary.rowCount} rows across ${primary.headers.length} columns.`
                };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
          }, (results) => {
            if (results && results[0] && results[0].result) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: "Failed to extract table data from tab." });
            }
          });
        } else if (name === "search_tabs") {
          const query = (args.query || "").toLowerCase().trim();
          chrome.tabs.query({}, (tabs) => {
            if (!tabs) {
              resolve({ success: false, error: "Failed to query tabs." });
              return;
            }
            const matches = tabs.filter(t => {
              if (!query) return true;
              const title = (t.title || "").toLowerCase();
              const url = (t.url || "").toLowerCase();
              return title.includes(query) || url.includes(query);
            }).map(t => ({
              id: t.id,
              title: t.title,
              url: t.url,
              active: t.active,
              windowId: t.windowId
            }));

            resolve({
              success: true,
              query: query,
              count: matches.length,
              tabs: matches,
              message: `Found ${matches.length} matching tab${matches.length === 1 ? '' : 's'}.`
            });
          });
        } else if (name === "close_tab") {
          const tabIdToClose = args.tabId !== undefined ? Number(args.tabId) : activeTab.id;
          chrome.tabs.remove(tabIdToClose, () => {
            resolve({
              success: true,
              tabId: tabIdToClose,
              message: `Tab ID ${tabIdToClose} successfully closed.`
            });
          });
        } else if (name === "fill_form") {
          const fields = args.fields || [];
          const submitAfter = !!args.submitAfter;
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (fieldsToFill, autoSubmit) => {
              const results = [];
              let filledCount = 0;

              fieldsToFill.forEach((field) => {
                let el = null;
                if (field.selector) {
                  try { el = document.querySelector(field.selector); } catch (e) {}
                }
                if (!el && field.name) {
                  el = document.querySelector(`[name="${field.name}"], #${field.name}`);
                }
                if (!el && field.label) {
                  const lbl = field.label.toLowerCase();
                  // Try placeholder or aria-label
                  el = document.querySelector(`input[placeholder*="${field.label}" i], textarea[placeholder*="${field.label}" i], [aria-label*="${field.label}" i]`);
                  if (!el) {
                    const labelEls = Array.from(document.querySelectorAll('label'));
                    const matchingLabel = labelEls.find(l => (l.innerText || '').toLowerCase().includes(lbl));
                    if (matchingLabel) {
                      if (matchingLabel.htmlFor) {
                        el = document.getElementById(matchingLabel.htmlFor);
                      }
                      if (!el) {
                        el = matchingLabel.querySelector('input, textarea, select');
                      }
                    }
                  }
                }

                if (!el) {
                  results.push({ field: field.name || field.label || field.selector, status: "not_found" });
                  return;
                }

                const tag = el.tagName.toLowerCase();
                const type = (el.getAttribute('type') || '').toLowerCase();

                if (type === 'checkbox' || type === 'radio') {
                  const isCheck = field.value === true || field.value === 'true' || field.value === '1';
                  el.checked = isCheck;
                } else if (tag === 'select') {
                  el.value = String(field.value);
                } else {
                  el.value = String(field.value);
                }

                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                filledCount++;
                results.push({ field: field.name || field.label || field.selector, status: "filled", value: field.value });
              });

              let submitted = false;
              if (autoSubmit) {
                const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], button.btn-primary');
                if (submitBtn) {
                  submitBtn.click();
                  submitted = true;
                }
              }

              return {
                success: true,
                fieldsFilled: filledCount,
                submitted: submitted,
                details: results
              };
            },
            args: [fields, submitAfter]
          }, (res) => {
            if (res && res[0] && res[0].result) {
              resolve(res[0].result);
            } else {
              resolve({ success: false, error: "Failed to fill form fields." });
            }
          });
        } else if (name === "extract_media") {
          const mediaType = args.type || "all";
          const minDim = args.minDimensions !== undefined ? Number(args.minDimensions) : 50;
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (targetType, minSize) => {
              const images = Array.from(document.querySelectorAll('img')).filter(img => {
                const w = img.naturalWidth || img.width || 0;
                const h = img.naturalHeight || img.height || 0;
                return (w >= minSize && h >= minSize) || (img.src && !img.src.startsWith('data:image/svg'));
              }).slice(0, 50).map(img => ({
                src: img.src,
                alt: img.alt || '',
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0
              }));

              const videos = Array.from(document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]')).slice(0, 20).map(v => ({
                src: v.src || v.querySelector('source')?.src || '',
                poster: v.poster || ''
              }));

              const docLinks = Array.from(document.querySelectorAll('a[href$=".pdf"], a[href$=".zip"], a[href$=".docx"], a[href$=".xlsx"], a[href$=".csv"]')).slice(0, 30).map(a => ({
                href: a.href,
                text: (a.innerText || a.textContent || '').trim()
              }));

              return {
                success: true,
                totalMedia: images.length + videos.length + docLinks.length,
                imageCount: images.length,
                videoCount: videos.length,
                docCount: docLinks.length,
                images: targetType === 'all' || targetType === 'images' ? images : [],
                videos: targetType === 'all' || targetType === 'videos' ? videos : [],
                documents: targetType === 'all' || targetType === 'documents' ? docLinks : []
              };
            },
            args: [mediaType, minDim]
          }, (res) => {
            if (res && res[0] && res[0].result) {
              resolve(res[0].result);
            } else {
              resolve({ success: false, error: "Failed to extract media." });
            }
          });
        } else if (name === "compare_tabs") {
          const tabIdA = Number(args.tabIdA);
          const tabIdB = args.tabIdB !== undefined ? Number(args.tabIdB) : activeTab.id;

          chrome.tabs.get(tabIdA, (tabA) => {
            chrome.tabs.get(tabIdB, (tabB) => {
              resolve({
                success: true,
                tabA: { id: tabA?.id, title: tabA?.title, url: tabA?.url },
                tabB: { id: tabB?.id, title: tabB?.title, url: tabB?.url },
                message: `Successfully retrieved metadata for Tab ${tabIdA} and Tab ${tabIdB}.`
              });
            });
          });
        } else if (name === "tts_speak") {
          const txt = args.text || "";
          if (typeof window !== "undefined" && window.speechSynthesis) {
            try {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(txt.substring(0, 400));
              utterance.rate = args.rate || 1.0;
              utterance.pitch = args.pitch || 1.0;
              window.speechSynthesis.speak(utterance);
            } catch (e) {
              console.warn("TTS speak warning:", e);
            }
          }
          resolve({
            success: true,
            spokenLength: txt.length,
            message: "Spoke text aloud."
          });
        } else if (name === "download_markdown_report") {
          const filename = args.filename || "research-summary.md";
          const content = args.markdownContent || "";
          try {
            const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn("Download error:", e);
          }
          resolve({
            success: true,
            filename: filename,
            bytes: content.length,
            message: `Downloaded Markdown report file "${filename}".`
          });
        } else if (name === "update_plan") {
          const plan = args.plan || [];
          const currIdx = args.currentStepIndex || 1;
          const activeStep = plan.find(p => p.step === currIdx) || plan[0];
          resolve({
            success: true,
            totalSteps: plan.length,
            currentStep: currIdx,
            activeGoal: activeStep?.goal || "In Progress",
            activeStatus: activeStep?.status || "in_progress",
            message: `Updated task plan: Step ${currIdx}/${plan.length} (${activeStep?.goal || "Milestone"}).`
          });
        } else if (name === "manage_scratchpad") {
          const act = args.action || "read";
          const key = args.key || "default";
          const content = args.content || "";
          
          if (!window._agentScratchpad) {
            window._agentScratchpad = {};
          }
          
          if (act === "write") {
            window._agentScratchpad[key] = content;
          } else if (act === "append") {
            window._agentScratchpad[key] = (window._agentScratchpad[key] ? window._agentScratchpad[key] + "\n" : "") + content;
          } else if (act === "clear") {
            delete window._agentScratchpad[key];
          }
          
          resolve({
            success: true,
            action: act,
            key: key,
            currentValue: window._agentScratchpad[key] || "",
            allKeys: Object.keys(window._agentScratchpad),
            message: `Successfully performed scratchpad action "${act}" on key "${key}".`
          });
        } else if (name === "execute_custom_script") {
          const code = args.code || "";
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (scriptCode) => {
              try {
                const fn = new Function(scriptCode);
                const res = fn();
                return { success: true, result: res };
              } catch (e) {
                return { success: false, error: e.toString() };
              }
            },
            args: [code]
          }, (res) => {
            if (res && res[0] && res[0].result) {
              resolve(res[0].result);
            } else {
              resolve({ success: false, error: "Failed to evaluate script." });
            }
          });
        } else if (name === "wait_for_condition") {
          const sel = args.selector || "";
          const txt = args.textIncludes || "";
          const timeout = Math.min(Number(args.timeoutMs) || 3000, 10000);

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (targetSelector, targetText, maxWait) => {
              return new Promise((resolveWait) => {
                const start = performance.now();
                const check = () => {
                  let satisfied = false;
                  if (targetSelector) {
                    try {
                      if (document.querySelector(targetSelector)) satisfied = true;
                    } catch (e) {}
                  }
                  if (targetText && !satisfied) {
                    if ((document.body?.innerText || '').toLowerCase().includes(targetText.toLowerCase())) {
                      satisfied = true;
                    }
                  }
                  if (!targetSelector && !targetText) {
                    satisfied = true;
                  }

                  const elapsed = performance.now() - start;
                  if (satisfied || elapsed >= maxWait) {
                    resolveWait({
                      success: true,
                      conditionMet: satisfied,
                      elapsedMs: Math.round(elapsed),
                      timedOut: !satisfied && elapsed >= maxWait
                    });
                  } else {
                    setTimeout(check, 100);
                  }
                };
                check();
              });
            },
            args: [sel, txt, timeout]
          }, (res) => {
            if (res && res[0] && res[0].result) {
              resolve(res[0].result);
            } else {
              resolve({ success: true, conditionMet: true, elapsedMs: 50 });
            }
          });
        } else if (name === "crawl_links") {
          const sel = args.selector || "a[href]";
          const keyword = (args.keywordFilter || "").toLowerCase();
          const limit = Math.min(Number(args.limit) || 20, 50);

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (targetSelector, filterKw, maxCount) => {
              const anchors = Array.from(document.querySelectorAll(targetSelector));
              const results = [];
              const seen = new Set();

              for (const a of anchors) {
                const href = a.href;
                const text = (a.innerText || a.textContent || "").trim();
                if (!href || href.startsWith("javascript:") || href.startsWith("#") || seen.has(href)) {
                  continue;
                }

                if (filterKw) {
                  if (!href.toLowerCase().includes(filterKw) && !text.toLowerCase().includes(filterKw)) {
                    continue;
                  }
                }

                seen.add(href);
                results.push({
                  url: href,
                  anchorText: text || "Untitled Link",
                  title: a.getAttribute("title") || ""
                });

                if (results.length >= maxCount) break;
              }

              return {
                success: true,
                count: results.length,
                links: results
              };
            },
            args: [sel, keyword, limit]
          }, (res) => {
            if (res && res[0] && res[0].result) {
              resolve(res[0].result);
            } else {
              resolve({ success: false, error: "Failed to extract crawl links." });
            }
          });
        } else if (name === "get_page_meta_seo") {
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              const getMeta = (name) => {
                const el = document.querySelector(`meta[name="${name}" i], meta[property="${name}" i]`);
                return el ? el.getAttribute('content') : '';
              };

              const og = {};
              document.querySelectorAll('meta[property^="og:"], meta[name^="og:"]').forEach(m => {
                const p = m.getAttribute('property') || m.getAttribute('name');
                if (p) og[p] = m.getAttribute('content') || '';
              });

              const headings = [];
              document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
                const txt = (h.innerText || '').trim();
                if (txt) {
                  headings.push({ level: h.tagName.toLowerCase(), text: txt.substring(0, 120) });
                }
              });

              const jsonLd = [];
              document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
                try {
                  jsonLd.push(JSON.parse(s.textContent || '{}'));
                } catch (e) {}
              });

              return {
                success: true,
                title: document.title,
                description: getMeta('description'),
                canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || window.location.href,
                keywords: getMeta('keywords'),
                author: getMeta('author'),
                og: og,
                headingsCount: headings.length,
                headingsOutline: headings.slice(0, 30),
                jsonLdCount: jsonLd.length,
                jsonLd: jsonLd
              };
            }
          }, (res) => {
            if (res && res[0] && res[0].result) {
              resolve(res[0].result);
            } else {
              resolve({ success: false, error: "Failed to extract SEO metadata." });
            }
          });
        } else {
          resolve({ error: "Unknown tool" });
        }
      });
    });
  }

  function preprocessThinkingTags(text) {
    if (!text) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith("<thinking>")) return text;
    
    const match = text.match(/^\s*(Thought|thought|Thinking|thinking)\s*(:\s*|\n+\s*)/i);
    if (match) {
      const startIndex = match.index + match[0].length;
      const rest = text.substring(startIndex);
      
      const transitionRegex = /\n\n(?=[a-zA-Z]|\*\*|#|-|\*|\[)/;
      const transitionMatch = rest.match(transitionRegex);
      if (transitionMatch) {
        const transitionIndex = transitionMatch.index;
        const thoughtContent = rest.substring(0, transitionIndex);
        const restContent = rest.substring(transitionIndex);
        return `<thinking>${thoughtContent}</thinking>${restContent}`;
      } else {
        return `<thinking>${rest}`;
      }
    }
    return text;
  }

  // Parses thinking blocks out of the text content
  function parseThinkingAndContent(text) {
    text = preprocessThinkingTags(text);
    const thinkingParts = [];
    let content = "";
    
    const thinkingStartTag = "<thinking>";
    const thinkingEndTag = "</thinking>";
    
    let currentText = text;
    
    while (currentText.length > 0) {
      const startIndex = currentText.indexOf(thinkingStartTag);
      if (startIndex !== -1) {
        content += currentText.substring(0, startIndex);
        const endIndex = currentText.indexOf(thinkingEndTag, startIndex + thinkingStartTag.length);
        if (endIndex !== -1) {
          thinkingParts.push(currentText.substring(startIndex + thinkingStartTag.length, endIndex));
          currentText = currentText.substring(endIndex + thinkingEndTag.length);
        } else {
          thinkingParts.push(currentText.substring(startIndex + thinkingStartTag.length));
          currentText = "";
        }
      } else {
        content += currentText;
        break;
      }
    }
    
    return {
      thinking: thinkingParts.map(t => t.trim()).filter(Boolean).join("\n\n"),
      content: content.trim()
    };
  }

  // Updates the assistant bubble with styled thinking and content blocks
  function updateAssistantBubble(assistantBubble, loaderDiv, accumulatedText) {
    if (loaderDiv && loaderDiv.parentNode === assistantBubble) {
      loaderDiv.remove();
    }

    const parsed = parseThinkingAndContent(accumulatedText);

    // 1. Handle Thinking Block
    let thinkingBlock = assistantBubble.querySelector(".thinking-block");
    if (parsed.thinking) {
      if (!thinkingBlock) {
        thinkingBlock = document.createElement("div");
        thinkingBlock.className = "thinking-block expanded"; // Default to expanded during streaming
        
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "thinking-toggle-btn";
        toggleBtn.innerHTML = `
          <span class="thinking-header-left">
            <span class="thinking-icon">🧠</span>
            <span class="thinking-text">Thinking Process</span>
          </span>
          <span class="thinking-arrow">▼</span>
        `;
        
        const contentDiv = document.createElement("div");
        contentDiv.className = "thinking-content";
        
        thinkingBlock.appendChild(toggleBtn);
        thinkingBlock.appendChild(contentDiv);
        
        toggleBtn.addEventListener("click", () => {
          thinkingBlock.classList.toggle("collapsed");
          thinkingBlock.classList.toggle("expanded");
        });
        
        const header = assistantBubble.querySelector(".message-header");
        if (header && header.nextSibling) {
          assistantBubble.insertBefore(thinkingBlock, header.nextSibling);
        } else {
          assistantBubble.appendChild(thinkingBlock);
        }
      }
      
      const contentDiv = thinkingBlock.querySelector(".thinking-content");
      if (contentDiv) {
        contentDiv.textContent = parsed.thinking;
      }
    } else if (thinkingBlock) {
      thinkingBlock.remove();
    }

    // 2. Handle Regular Content
    let answerDiv = assistantBubble.querySelector(".bubble-answer");
    if (!answerDiv) {
      answerDiv = document.createElement("div");
      answerDiv.className = "bubble-answer bubble-text";
      assistantBubble.appendChild(answerDiv);
    }
    
    if (parsed.content) {
      answerDiv.innerHTML = formatResponse(parsed.content);
    } else {
      answerDiv.textContent = parsed.thinking ? "" : "...";
    }
    
    // Auto-collapse thinking block when done thinking (when </thinking> is matched)
    if (thinkingBlock && accumulatedText.includes("</thinking>") && !thinkingBlock.dataset.autoCollapsed) {
      thinkingBlock.classList.add("collapsed");
      thinkingBlock.classList.remove("expanded");
      thinkingBlock.dataset.autoCollapsed = "true";
    }
  }

  // Render chat history from local storage
  function renderHistory() {
    chatLog.innerHTML = "";
    chatHistory.forEach(msg => {
      // Skip rendering intermediate tool-call/response messages that have no text and no inlineData attachments
      const hasRenderableContent = msg.parts && msg.parts.some(part => part.text || part.inlineData);
      if (!hasRenderableContent) {
        return;
      }

      const bubble = document.createElement("div");
      bubble.className = `message-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;

      const header = document.createElement("div");
      header.className = "message-header";
      header.innerHTML = `<span>${msg.role === 'user' ? 'You' : 'AcceleratedLogic'}</span>`;
      bubble.appendChild(header);

      // Render parts
      msg.parts.forEach(part => {
        if (part.text) {
          let text = part.text;
          if (text.includes("DOM innerText Context")) {
            const index = text.indexOf("User Prompt:");
            if (index !== -1) {
              text = "[Attached Webpage context] " + text.substring(index);
            }
          }
          
          if (msg.role === 'model') {
            const parsed = parseThinkingAndContent(text);
            
            if (parsed.thinking) {
              const thinkingBlock = document.createElement("div");
              thinkingBlock.className = "thinking-block collapsed"; // Collapsed in history
              
              const toggleBtn = document.createElement("button");
              toggleBtn.className = "thinking-toggle-btn";
              toggleBtn.innerHTML = `
                <span class="thinking-header-left">
                  <span class="thinking-icon">🧠</span>
                  <span class="thinking-text">Thinking Process</span>
                </span>
                <span class="thinking-arrow">▼</span>
              `;
              
              const contentDiv = document.createElement("div");
              contentDiv.className = "thinking-content";
              contentDiv.textContent = parsed.thinking;
              
              thinkingBlock.appendChild(toggleBtn);
              thinkingBlock.appendChild(contentDiv);
              
              toggleBtn.addEventListener("click", () => {
                thinkingBlock.classList.toggle("collapsed");
                thinkingBlock.classList.toggle("expanded");
              });
              
              bubble.appendChild(thinkingBlock);
            }
            
            const answerDiv = document.createElement("div");
            answerDiv.className = "bubble-answer bubble-text";
            answerDiv.innerHTML = formatResponse(parsed.content || "");
            bubble.appendChild(answerDiv);
          } else {
            const body = document.createElement("div");
            body.className = "bubble-text";
            body.textContent = text;
            bubble.appendChild(body);
          }
        } else if (part.inlineData) {
          // Render attached thumbnail indicator in history bubble
          const attachDiv = document.createElement("div");
          attachDiv.className = "bubble-attachment";
          
          const thumbIcon = document.createElement("span");
          thumbIcon.textContent = part.inlineData.mimeType.startsWith("image/") ? "🖼️" : "📎";
          thumbIcon.style.marginRight = "6px";
          attachDiv.appendChild(thumbIcon);

          const desc = document.createElement("span");
          desc.textContent = `Attachment (${part.inlineData.mimeType})`;
          attachDiv.appendChild(desc);

          bubble.appendChild(attachDiv);
        }
      });

      chatLog.appendChild(bubble);
    });
    scrollToBottom();
  }


  // Utilities
  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.position = "absolute";
    toast.style.bottom = "80px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "#1e293b";
    toast.style.border = "1px solid #475569";
    toast.style.color = "#f1f5f9";
    toast.style.padding = "8px 16px";
    toast.style.borderRadius = "20px";
    toast.style.fontSize = "0.8rem";
    toast.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    toast.style.zIndex = "100";
    toast.style.whiteSpace = "nowrap";
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  function formatSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function fetchWithBackoff(url, options, maxAttempts = 3, initialDelayMs = 1000, backoffFactor = 2) {
    let attempt = 0;
    while (true) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        const isRetriable = response.status === 429 || (response.status >= 500 && response.status < 600);
        if (!isRetriable || attempt >= maxAttempts - 1) {
          return response;
        }
      } catch (error) {
        if (error.name === "AbortError" || (options && options.signal && options.signal.aborted)) {
          throw error;
        }
        if (attempt >= maxAttempts - 1) {
          throw error;
        }
      }
      const delay = initialDelayMs * Math.pow(backoffFactor, attempt) * (0.8 + Math.random() * 0.4);
      attempt++;
      console.log(`[Backoff] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
});

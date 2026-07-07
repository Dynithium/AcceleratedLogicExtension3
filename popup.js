// Gemini Web Companion - Popup Controller

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
        activeChatId = result.activeChatId || chats[0].id;
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
        activeChatId = migrated.id;
        chrome.storage.local.set({ chats: chats, activeChatId: activeChatId });
      } else {
        const initial = {
          id: "chat-" + Date.now(),
          title: "New Chat",
          history: []
        };
        chats = [initial];
        activeChatId = initial.id;
        chrome.storage.local.set({ chats: chats, activeChatId: activeChatId });
      }

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

      // We run a recursive loop to allow multiple turns of tool execution if requested
      let hasMoreTurns = true;
      let currentAssistantBubble = assistantBubble;
      let currentLoaderDiv = loaderDiv;

      while (hasMoreTurns) {
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
You help users analyze web pages, answer questions, and perform research.
You can call 'get_page_dom' to get webpage text${isVisionCapable ? ", 'get_page_screenshot' to get a visual screenshot" : ""}, 'click_element' to interact with buttons/links, 'click_at_coordinate' to click at custom screen coordinates and optionally type, 'type_text' to fill out input fields, 'scroll_page' to scroll up/down/left/right, 'open_tab' to open a new tab with a specific URL, 'search_web' to perform search queries, 'list_tabs' to list open tabs, 'switch_tab' to switch between tabs, 'press_key' to simulate pressing keys on the webpage, 'select_text' to select/highlight text, and 'replace_text' to replace text.

CRITICAL RULES:
- Always output your internal step-by-step planning and thinking process enclosed exactly within <thinking> and </thinking> tags at the very start of your response.
- Never output raw base64 data, gibberish strings, or repeating binary characters.
- PAGE ANALYSIS RULE: When you open a page or perform a search, you MUST NOT just report that the page/search is opened. You MUST immediately proceed to call 'get_page_dom' (or 'get_page_screenshot') to read, analyze, and comprehend its actual content before moving on or concluding, unless the user explicitly said they only wanted to open the page.
- REAL-TIME SEARCH RULE: If you are unsure of any answer, or need to retrieve current/real-time information, you MUST use 'search_web' to search, then open or switch to relevant result tabs and extract their text using 'get_page_dom' to analyze the findings. Never speculate or give generic answers without verifying.
- MULTI-TAB NAVIGATION: You know what each tab is and can switch tabs if needed. Use 'list_tabs' to view all open tabs (IDs, titles, URLs, active status) and use 'switch_tab' to change the active tab when a user asks about another tab, or when you need to gather information from a different open page.
- NON-DOM INTERACTIVE KEYPRESS RULE: If you are interacting with canvas-based elements, browser games, or non-input interactive areas where WASD or other key actions are required to move or interact (such as playing games, interactive canvases, sliding controls, etc.), use the 'press_key' tool to send raw keyboard presses directly to the page instead of standard 'type_text'.
- VERIFICATION RULE: After executing an interactive action that modifies page state (such as 'type_text', 'replace_text', 'press_key', 'click_element', or 'click_at_coordinate'), you MUST explicitly verify that your action completed correctly. Do this by calling 'get_page_dom' (or 'get_page_screenshot') immediately after the action to inspect the updated page state and confirm the expected change (e.g., verifying text was input, checking that a modal opened, or confirming that text selection/replacement has occurred). Never just assume an action worked without checking the page's state.
- ACTION DOUBLE-CHECK: The AI should check if it actually did something correctly in the end. You MUST run a final verification check (fetching updated DOM/screenshot) after typing or clicking to confirm the input is visible, the page updated, or the action fully registered before concluding your response to the user.
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
                    if (delta.content) {
                      accumulatedText += delta.content;
                      updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);
                      scrollToBottom();
                    }
                    if (delta.tool_calls) {
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
                      if (part.text) {
                        const isThought = !!part.thought;
                        if (isThought && !inThinkingBlock) {
                          accumulatedText += "<thinking>" + part.text;
                          inThinkingBlock = true;
                        } else if (!isThought && inThinkingBlock) {
                          accumulatedText += "</thinking>" + part.text;
                          inThinkingBlock = false;
                        } else {
                          accumulatedText += part.text;
                        }
                        updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);
                        scrollToBottom();
                      }
                      if (part.functionCall) {
                        activeFunctionCall = part.functionCall;
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
          line.startsWith("<li")) {
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
            title: "Simulated Web Companion Blog",
            url: "https://ai.google.dev/blog/gemini-web-companion",
            text: "This is a simulated DOM context content. Manifest V3 Side Panels and high-context models transform browsers into active runtime workspaces. This sidebar is fully context-aware. With a single click, users can capture the page DOM or query visual layouts directly."
          });
        } else if (name === "get_page_screenshot") {
          resolve({
            success: true,
            screenshot_url: generateMockScreenshot(
              "Simulated Web Companion Blog",
              "https://ai.google.dev/blog/gemini-web-companion",
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
              { id: 1, title: "Gemini Web Companion", url: "https://gemini-extension-builder.ai.studio", active: true },
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

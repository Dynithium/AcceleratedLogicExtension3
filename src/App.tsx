import React, { useState, useEffect, useRef } from "react";
import { 
  Settings, 
  Sparkles, 
  Puzzle, 
  HelpCircle, 
  FolderOpen, 
  FileCode, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  Paperclip, 
  Send, 
  Square,
  Plus, 
  X, 
  Eye, 
  EyeOff,
  Laptop,
  Check,
  RotateCw,
  Globe,
  MessageSquare,
  Trash2
} from "lucide-react";

// Code listings to display in the live Explorer
const MANIFEST_CODE = `{
  "manifest_version": 3,
  "name": "Gemini Web Companion",
  "version": "1.0.0",
  "description": "Talk to Gemini models directly from your browser. Upload files, capture screenshots, and query current page DOM context.",
  "permissions": [
    "sidePanel",
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_icon": "icon.svg"
  },
  "side_panel": {
    "default_path": "popup.html"
  },
  "icons": {
    "16": "icon.svg",
    "32": "icon.svg",
    "48": "icon.svg",
    "128": "icon.svg"
  },
  "background": {
    "service_worker": "background.js"
  }
}`;

const BACKGROUND_CODE = `// Gemini Web Companion - Background Script
// This background worker listens for installation events.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Gemini Web Companion Chrome Extension installed successfully.");
});

// Enable opening the side panel on clicking the action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));`;

const POPUP_HTML_CODE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gemini Web Companion</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="app-container">
    <!-- Header Section -->
    <header class="app-header">
      <div class="logo-area">
        <span class="sparkle-icon">✨</span>
        <h1 class="title">Gemini Companion</h1>
      </div>
      <button id="btn-settings" class="icon-button" title="Configure Settings">⚙️</button>
    </header>

    <!-- Settings Pane (Collapsible) -->
    <div id="settings-pane" class="settings-pane collapsed">
      <div class="settings-header">
        <h3>Configuration</h3>
      </div>
      <div class="settings-body">
        <div class="form-group">
          <label for="input-api-key">Gemini API Key</label>
          <div class="input-with-action">
            <input type="password" id="input-api-key" placeholder="Enter your Gemini API Key..." />
            <button id="btn-toggle-key-visibility" class="text-button">Show</button>
          </div>
          <p class="help-text">Stored securely in your local browser storage.</p>
        </div>
        <div class="form-group">
          <label for="select-model">Model Selection</label>
          <select id="select-model">
            <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro (High intelligence)</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            <option value="custom">-- Custom Model ID --</option>
          </select>
        </div>
        <div class="form-group" id="custom-model-group" style="display: none;">
          <label for="input-custom-model">Custom Model ID</label>
          <input type="text" id="input-custom-model" placeholder="e.g. gemini-3.5-flash" />
        </div>
        <div class="settings-actions">
          <button id="btn-save-settings" class="primary-button">Save Settings</button>
        </div>
      </div>
    </div>

    <!-- Chat Message Log -->
    <main class="chat-log" id="chat-log">
      <!-- Starter/Welcome Screen -->
      <div id="welcome-screen" class="welcome-screen">
        <div class="welcome-icon">💬</div>
        <h2>Welcome to Gemini Companion</h2>
        <p>Talk to Gemini directly from any browser tab! Capture screens, upload files, and chat seamlessly.</p>
        
        <div class="preset-suggestions">
          <button class="preset-btn" data-prompt="Summarize this web page for me.">📝 Summarize this page</button>
          <button class="preset-btn" data-prompt="What are the key takeaways from this website?">💡 Key takeaways</button>
          <button class="preset-btn" data-prompt="Explain the main concepts here in simple terms.">🧠 Explain main concepts</button>
        </div>

        <div class="status-warning" id="welcome-key-warning">
          ⚠️ Please click the gear icon (⚙️) above to configure your Gemini API Key.
        </div>
      </div>
    </main>

    <!-- Attached Asset Area -->
    <div id="attachment-preview" class="attachment-preview hidden">
      <div class="preview-card">
        <span class="attachment-icon" id="attachment-type-icon">📎</span>
        <div class="attachment-details">
          <span class="attachment-name" id="attachment-name">screenshot.png</span>
          <span class="attachment-size" id="attachment-size">Page Capture</span>
        </div>
        <button id="btn-remove-attachment" class="remove-button">×</button>
      </div>
    </div>

    <!-- Interactive Input Panel -->
    <footer class="app-input-panel">
      <div class="prompt-controls">
        <div class="relative-container">
          <button id="btn-plus" class="plus-button">＋</button>
          
          <div id="plus-menu" class="plus-menu hidden">
            <button id="menu-upload-file" class="menu-item"><span class="icon">📁</span> Upload File</button>
            <button id="menu-capture-page" class="menu-item"><span class="icon">📸</span> Capture Tab (Screenshot + DOM)</button>
          </div>
        </div>

        <input type="file" id="hidden-file-input" style="display: none;" />
        <textarea id="prompt-input" placeholder="Type a message or query page context..." rows="1"></textarea>
        <button id="btn-send" class="send-button">
          <svg viewBox="0 0 24 24" class="send-icon"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" /></svg>
        </button>
      </div>
    </footer>
  </div>
</body>
</html>`;

const POPUP_CSS_CODE = `/* Google Gemini Web Companion - Style Sheet */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  width: 100%;
  height: 100vh;
  background-color: #0f172a;
  color: #f1f5f9;
  overflow: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  z-index: 10;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sparkle-icon {
  font-size: 1.25rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.title {
  font-size: 1rem;
  font-weight: 600;
  color: #f8fafc;
}

.icon-button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  font-size: 1.2rem;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.icon-button:hover {
  background-color: #334155;
  color: #f1f5f9;
}

.settings-pane {
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  max-height: 250px;
  overflow-y: auto;
  transition: all 0.3s ease-out;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-pane.collapsed {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-bottom-width: 0;
  opacity: 0;
  overflow: hidden;
}

.settings-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #cbd5e1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
}

.form-group input, .form-group select {
  background-color: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.85rem;
}

.input-with-action {
  display: flex;
  gap: 8px;
}

.text-button {
  background-color: #334155;
  border: none;
  color: #cbd5e1;
  font-size: 0.75rem;
  padding: 0 12px;
  border-radius: 6px;
  cursor: pointer;
}

.primary-button {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.chat-log {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: #0f172a;
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  margin-top: auto;
  margin-bottom: auto;
}

.welcome-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.preset-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 16px;
}

.preset-btn {
  background-color: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.preset-btn:hover {
  background-color: #334155;
  color: #f8fafc;
}

.status-warning {
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  font-size: 0.75rem;
  padding: 8px;
  border-radius: 6px;
  margin-top: 12px;
}

.message-bubble {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.85rem;
  line-height: 1.45;
}

.message-bubble.user {
  align-self: flex-end;
  background-color: #2563eb;
  color: white;
  border-bottom-right-radius: 2px;
}

.message-bubble.assistant {
  align-self: flex-start;
  background-color: #1e293b;
  color: #cbd5e1;
  border-bottom-left-radius: 2px;
  border: 1px solid #334155;
}

.message-header {
  font-size: 0.7rem;
  font-weight: 500;
  margin-bottom: 4px;
  opacity: 0.8;
  display: flex;
  justify-content: space-between;
}

.bubble-attachment {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
  font-size: 0.75rem;
}

.bubble-attachment-thumbnail {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #334155;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.attachment-preview {
  padding: 8px 16px;
  background-color: #1e293b;
  border-top: 1px solid #334155;
  display: flex;
}

.attachment-preview.hidden {
  display: none !important;
}

.preview-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px 12px;
  width: 100%;
}

.app-input-panel {
  padding: 12px 16px;
  background-color: #1e293b;
  border-top: 1px solid #334155;
}

.prompt-controls {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.relative-container {
  position: relative;
}

.plus-button {
  background-color: #334155;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 1.2rem;
  cursor: pointer;
}

.plus-menu {
  position: absolute;
  bottom: 44px;
  left: 0;
  background-color: #1e293b;
  border: 1px solid #475569;
  border-radius: 8px;
  width: 240px;
  padding: 4px;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.plus-menu.hidden {
  display: none !important;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  color: #cbd5e1;
  padding: 8px 12px;
  font-size: 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.menu-item:hover {
  background-color: #334155;
  color: #f8fafc;
}

#prompt-input {
  flex: 1;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f1f5f9;
  padding: 8px 12px;
  font-size: 0.85rem;
  outline: none;
  resize: none;
}

.send-button {
  background-color: #2563eb;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-icon {
  width: 18px;
  height: 18px;
  fill: #ffffff;
}

/* Collapsible Thinking Block Styling */
.thinking-block {
  margin-top: 6px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: rgba(30, 41, 59, 0.4);
  border: 1px dashed rgba(59, 130, 246, 0.25);
  overflow: hidden;
}

.thinking-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: rgba(59, 130, 246, 0.06);
  border: none;
  cursor: pointer;
  color: #93c5fd;
  font-size: 0.725rem;
  font-weight: 500;
  text-align: left;
  outline: none;
}

.thinking-toggle-btn:hover {
  background-color: rgba(59, 130, 246, 0.12);
}

.thinking-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.thinking-icon {
  font-size: 0.8rem;
  animation: pulse-slow 2s infinite ease-in-out;
}

.thinking-arrow {
  transition: transform 0.2s ease;
  font-size: 0.65rem;
  color: #64748b;
}

.thinking-block.expanded .thinking-arrow {
  transform: rotate(180deg);
}

.thinking-content {
  padding: 8px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.725rem;
  color: #94a3b8;
  line-height: 1.4;
  white-space: pre-wrap;
  border-top: 1px solid rgba(59, 130, 246, 0.12);
  max-height: 130px;
  overflow-y: auto;
}

.thinking-block.collapsed .thinking-content {
  display: none;
}

@keyframes pulse-slow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
`;

const POPUP_JS_CODE = `// Gemini Web Companion - Popup Controller
document.addEventListener("DOMContentLoaded", () => {
  const btnSettings = document.getElementById("btn-settings");
  const settingsPane = document.getElementById("settings-pane");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const inputApiKey = document.getElementById("input-api-key");
  const btnToggleKeyVisibility = document.getElementById("btn-toggle-key-visibility");
  const selectModel = document.getElementById("select-model");
  const customModelGroup = document.getElementById("custom-model-group");
  const inputCustomModel = document.getElementById("input-custom-model");

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

  let apiKey = "";
  let modelId = "gemini-2.5-flash";
  let activeAttachment = null;
  let chatHistory = [];

  // Load Settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["apiKey", "modelId", "customModelId", "chatHistory"], (result) => {
      if (result.apiKey) {
        apiKey = result.apiKey;
        inputApiKey.value = apiKey;
        welcomeKeyWarning.style.display = "none";
      }
      if (result.modelId) {
        modelId = result.modelId;
        selectModel.value = modelId;
        if (modelId === "custom") {
          customModelGroup.style.display = "block";
          if (result.customModelId) inputCustomModel.value = result.customModelId;
        }
      }
      if (result.chatHistory) {
        chatHistory = result.chatHistory;
        welcomeScreen.style.display = "none";
        renderHistory();
      }
    });
  }

  btnSettings.addEventListener("click", () => settingsPane.classList.toggle("collapsed"));

  btnToggleKeyVisibility.addEventListener("click", () => {
    if (inputApiKey.type === "password") {
      inputApiKey.type = "text";
      btnToggleKeyVisibility.textContent = "Hide";
    } else {
      inputApiKey.type = "password";
      btnToggleKeyVisibility.textContent = "Show";
    }
  });

  selectModel.addEventListener("change", () => {
    customModelGroup.style.display = selectModel.value === "custom" ? "block" : "none";
  });

  btnSaveSettings.addEventListener("click", () => {
    apiKey = inputApiKey.value.trim();
    let selectedVal = selectModel.value;
    modelId = selectedVal === "custom" ? inputCustomModel.value.trim() : selectedVal;

    chrome.storage.local.set({
      apiKey,
      modelId: selectedVal,
      customModelId: inputCustomModel.value.trim()
    }, () => {
      settingsPane.classList.add("collapsed");
      welcomeKeyWarning.style.display = apiKey ? "none" : "block";
      showToast("Settings saved!");
    });
  });

  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      promptInput.value = btn.getAttribute("data-prompt");
      promptInput.focus();
    });
  });

  btnPlus.addEventListener("click", (e) => {
    e.stopPropagation();
    plusMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => plusMenu.classList.add("hidden"));

  menuUploadFile.addEventListener("click", () => hiddenFileInput.click());

  hiddenFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        mimeType: file.type,
        base64: event.target.result
      });
    };
    reader.readAsDataURL(file);
  });

  menuCapturePage.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const activeTab = tabs[0];
      
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => ({
          title: document.title,
          url: window.location.href,
          text: document.body ? document.body.innerText.substring(0, 40000) : ""
        })
      }, (results) => {
        let extractedDom = { title: activeTab.title, url: activeTab.url, text: "" };
        if (results && results[0]) extractedDom = results[0].result;

        chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (screenshotUrl) => {
          setAttachment({
            name: \`Capture: \${extractedDom.title}\`,
            size: "Webpage + DOM Context",
            mimeType: "image/jpeg",
            base64: screenshotUrl || "",
            domContext: extractedDom
          });
          if (!promptInput.value.trim()) {
            promptInput.value = "Summarize or explain this page.";
          }
        });
      });
    });
  });

  function setAttachment(obj) {
    activeAttachment = obj;
    attachmentNameElement.textContent = obj.name;
    attachmentSizeElement.textContent = obj.size;
    attachmentTypeIcon.textContent = obj.mimeType.startsWith("image/") ? "🖼️" : "📄";
    attachmentPreview.classList.remove("hidden");
  }

  btnRemoveAttachment.addEventListener("click", () => {
    activeAttachment = null;
    attachmentPreview.classList.add("hidden");
  });

  btnSend.addEventListener("click", sendMessage);

  async function sendMessage() {
    const prompt = promptInput.value.trim();
    if (!prompt && !activeAttachment) return;
    if (!apiKey) {
      showToast("Pasted API Key is required!");
      return;
    }

    welcomeScreen.style.display = "none";
    appendUserMessage(prompt, activeAttachment);

    let userParts = [];
    let finalPrompt = prompt;

    if (activeAttachment) {
      if (activeAttachment.domContext) {
        finalPrompt = \`[Context URL: \${activeAttachment.domContext.url}]\\n\\nDOM content:\\n---\\n\${activeAttachment.domContext.text}\\n---\\n\\nUser question: \${prompt || "Explain page"}\`;
      }
      userParts.push({
        inlineData: {
          mimeType: activeAttachment.mimeType,
          data: activeAttachment.base64.split(",")[1]
        }
      });
    }

    userParts.push({ text: finalPrompt || "Analyze this context" });
    chatHistory.push({ role: "user", parts: userParts });

    const assistBubble = appendAssistantLoading();
    
    // Clear inputs
    promptInput.value = "";
    const currentAttach = activeAttachment;
    activeAttachment = null;
    attachmentPreview.classList.add("hidden");

    try {
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${modelId}:streamGenerateContent?key=\${apiKey}\`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: chatHistory })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error?.message || \`API Error: \${response.status}\`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let buffer = "";

      const loader = assistBubble.querySelector(".loading-indicator");

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
            if (char === '\\\\') {
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
              const text = obj.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (text) {
                accumulatedText += text;
                updateAssistantBubble(assistBubble, loader, accumulatedText);
                chatLog.scrollTop = chatLog.scrollHeight;
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

      if (!accumulatedText) {
        throw new Error("No text content returned from the stream.");
      }

      chatHistory.push({ role: "model", parts: [{ text: accumulatedText }] });
      chrome.storage.local.set({ chatHistory });
    } catch (e) {
      const loader = assistBubble.querySelector(".loading-indicator");
      if (loader) loader.remove();
      const errDiv = document.createElement("div");
      errDiv.className = "bubble-text";
      errDiv.style.color = "#ef4444";
      errDiv.textContent = "Error: " + e.message;
      assistBubble.appendChild(errDiv);
      chatHistory.pop();
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function parseThinkingAndContent(text) {
    let thinking = "";
    let content = text;
    const thinkingStartTag = "<thinking>";
    const thinkingEndTag = "</thinking>";
    const startIndex = text.indexOf(thinkingStartTag);
    if (startIndex !== -1) {
      const endIndex = text.indexOf(thinkingEndTag);
      if (endIndex !== -1) {
        thinking = text.substring(startIndex + thinkingStartTag.length, endIndex);
        content = text.substring(0, startIndex) + text.substring(endIndex + thinkingEndTag.length);
      } else {
        thinking = text.substring(startIndex + thinkingStartTag.length);
        content = text.substring(0, startIndex);
      }
    }
    return { thinking: thinking.trim(), content: content.trim() };
  }

  function updateAssistantBubble(assistantBubble, loaderDiv, accumulatedText) {
    if (loaderDiv && loaderDiv.parentNode === assistantBubble) {
      loaderDiv.remove();
    }
    const parsed = parseThinkingAndContent(accumulatedText);
    let thinkingBlock = assistantBubble.querySelector(".thinking-block");
    if (parsed.thinking) {
      if (!thinkingBlock) {
        thinkingBlock = document.createElement("div");
        thinkingBlock.className = "thinking-block expanded";
        
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "thinking-toggle-btn";
        toggleBtn.innerHTML = \`
          <span class="thinking-header-left">
            <span class="thinking-icon">🧠</span>
            <span class="thinking-text">Thinking Process</span>
          </span>
          <span class="thinking-arrow">▼</span>
        \`;
        
        const contentDiv = document.createElement("div");
        contentDiv.className = "thinking-content";
        thinkingBlock.appendChild(toggleBtn);
        thinkingBlock.appendChild(contentDiv);
        
        toggleBtn.addEventListener("click", () => {
          thinkingBlock.classList.toggle("collapsed");
          thinkingBlock.classList.toggle("expanded");
        });
        
        assistantBubble.appendChild(thinkingBlock);
      }
      const contentDiv = thinkingBlock.querySelector(".thinking-content");
      if (contentDiv) contentDiv.textContent = parsed.thinking;
    }
    
    let answerDiv = assistantBubble.querySelector(".bubble-answer");
    if (!answerDiv) {
      answerDiv = document.createElement("div");
      answerDiv.className = "bubble-answer bubble-text";
      assistantBubble.appendChild(answerDiv);
    }
    answerDiv.textContent = parsed.content || (parsed.thinking ? "" : "...");
    
    if (thinkingBlock && accumulatedText.includes("</thinking>") && !thinkingBlock.dataset.autoCollapsed) {
      thinkingBlock.classList.add("collapsed");
      thinkingBlock.classList.remove("expanded");
      thinkingBlock.dataset.autoCollapsed = "true";
    }
  }

  function appendUserMessage(p, attachment) {
    const bubble = document.createElement("div");
    bubble.className = "message-bubble user";
    if (attachment) {
      const att = document.createElement("div");
      att.className = "bubble-attachment";
      att.innerHTML = \`<span style="margin-right:6px">\${attachment.mimeType.startsWith("image/") ? "🖼️" : "📄"}</span> <span>\${attachment.name}</span>\`;
      bubble.appendChild(att);
    }
    const txt = document.createElement("div");
    txt.className = "bubble-text";
    txt.textContent = p || "[Attachment]";
    bubble.appendChild(txt);
    chatLog.appendChild(bubble);
  }

  function appendAssistantLoading() {
    const bubble = document.createElement("div");
    bubble.className = "message-bubble assistant";
    bubble.innerHTML = \`<div class="loading-indicator"><div class="spinner"></div> <span>Gemini is thinking...</span></div>\`;
    chatLog.appendChild(bubble);
    return bubble;
  }

  function renderHistory() {
    chatHistory.forEach(msg => {
      const b = document.createElement("div");
      b.className = "message-bubble " + (msg.role === "user" ? "user" : "assistant");
      msg.parts.forEach(part => {
        if (part.text) {
          if (msg.role === "model") {
            const parsed = parseThinkingAndContent(part.text);
            if (parsed.thinking) {
              const thinkingBlock = document.createElement("div");
              thinkingBlock.className = "thinking-block collapsed";
              const toggleBtn = document.createElement("button");
              toggleBtn.className = "thinking-toggle-btn";
              toggleBtn.innerHTML = \`
                <span class="thinking-header-left">
                  <span class="thinking-icon">🧠</span>
                  <span class="thinking-text">Thinking Process</span>
                </span>
                <span class="thinking-arrow">▼</span>
              \`;
              const contentDiv = document.createElement("div");
              contentDiv.className = "thinking-content";
              contentDiv.textContent = parsed.thinking;
              thinkingBlock.appendChild(toggleBtn);
              thinkingBlock.appendChild(contentDiv);
              toggleBtn.addEventListener("click", () => {
                thinkingBlock.classList.toggle("collapsed");
                thinkingBlock.classList.toggle("expanded");
              });
              b.appendChild(thinkingBlock);
            }
            const answerDiv = document.createElement("div");
            answerDiv.className = "bubble-answer bubble-text";
            answerDiv.textContent = parsed.content || "";
            b.appendChild(answerDiv);
          } else {
            const t = document.createElement("div");
            t.className = "bubble-text";
            t.textContent = part.text.includes("DOM content") ? "[Analyzed Webpage Context]" : part.text;
            b.appendChild(t);
          }
        }
      });
      chatLog.appendChild(b);
    });
  }

  function showToast(text) {
    const t = document.createElement("div");
    t.style = "position:absolute; bottom:80px; left:50%; transform:translateX(-50%); background:#1e293b; color:#fff; padding:6px 12px; border-radius:15px; font-size:0.75rem; z-index:99";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }
});`;

// React Formatting & LaTeX math parser
const renderLatexUnicode = (formula: string) => {
  let text = formula;
  const replacements: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
    '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π',
    '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Delta': 'Δ', '\\Gamma': 'Γ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ',
    '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
    '\\infty': '∞', '\\pm': '±', '\\times': '×', '\\div': '÷', 
    '\\neq': '≠', '\\approx': '≈', '\\leq': '≤', '\\geq': '≥', '\\le': '≤', '\\ge': '≥',
    '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
    '\\partial': '∂', '\\nabla': '∇', '\\cdot': '·', '\\bullet': '•',
    '\\forall': '∀', '\\exists': '∃', '\\in': '∈', '\\notin': '∉', '\\ni': '∋',
    '\\subset': '⊂', '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇',
    '\\cup': '∪', '\\cap': '∩', '\\empty': '∅', '\\varnothing': '∅',
    '\\int': '∫', '\\sum': '∑', '\\prod': '∏', '\\sqrt': '√'
  };

  const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(key.replace(/\\/g, '\\\\'), 'g');
    text = text.replace(regex, replacements[key]);
  }

  text = text.replace(/\^\{([^\}]+?)\}/g, '^($1)');
  text = text.replace(/_\{([^\}]+?)\}/g, '_($1)');
  text = text.replace(/\\frac\{([^\}]+?)\}\{([^\}]+?)\}/g, '($1/$2)');
  text = text.replace(/\\/g, '');
  return text;
};

const renderInlineStyles = (text: string) => {
  let parts: Array<{ type: 'text' | 'bold' | 'italic' | 'code' | 'latex'; content: string }> = [
    { type: 'text', content: text }
  ];

  let nextParts: typeof parts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const subParts = part.content.split(/\$([^\$\n]+?)\$/g);
      subParts.forEach((sub, subIdx) => {
        if (subIdx % 2 === 1) {
          if (/^\d+(\.\d+)?(M|K|B)?$/.test(sub)) {
            nextParts.push({ type: 'text', content: `$${sub}$` });
          } else {
            nextParts.push({ type: 'latex', content: sub });
          }
        } else if (sub) {
          nextParts.push({ type: 'text', content: sub });
        }
      });
    } else {
      nextParts.push(part);
    }
  }
  parts = nextParts;

  nextParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const subParts = part.content.split(/`([^`\n]+?)`/g);
      subParts.forEach((sub, subIdx) => {
        if (subIdx % 2 === 1) {
          nextParts.push({ type: 'code', content: sub });
        } else if (sub) {
          nextParts.push({ type: 'text', content: sub });
        }
      });
    } else {
      nextParts.push(part);
    }
  }
  parts = nextParts;

  nextParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const subParts = part.content.split(/\*\*([\s\S]+?)\*\*/g);
      subParts.forEach((sub, subIdx) => {
        if (subIdx % 2 === 1) {
          nextParts.push({ type: 'bold', content: sub });
        } else if (sub) {
          nextParts.push({ type: 'text', content: sub });
        }
      });
    } else {
      nextParts.push(part);
    }
  }
  parts = nextParts;

  nextParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const subParts = part.content.split(/\*([\s\S]+?)\*/g);
      subParts.forEach((sub, subIdx) => {
        if (subIdx % 2 === 1) {
          nextParts.push({ type: 'italic', content: sub });
        } else if (sub) {
          nextParts.push({ type: 'text', content: sub });
        }
      });
    } else {
      nextParts.push(part);
    }
  }
  parts = nextParts;

  return parts.map((part, idx) => {
    switch (part.type) {
      case 'bold':
        return <strong key={idx} className="font-bold text-slate-100">{part.content}</strong>;
      case 'italic':
        return <em key={idx} className="italic text-slate-300">{part.content}</em>;
      case 'code':
        return (
          <code key={idx} className="font-mono text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-300 px-1 py-0.5 rounded">
            {part.content}
          </code>
        );
      case 'latex':
        return (
          <span key={idx} className="font-serif italic text-blue-400 px-0.5">
            {renderLatexUnicode(part.content)}
          </span>
        );
      default:
        return <span key={idx}>{part.content}</span>;
    }
  });
};

const renderMarkdownTextBlock = (text: string) => {
  const paragraphs = text.split(/\n{2,}/);
  
  return paragraphs.map((para, paraIdx) => {
    const trimmed = para.trim();
    if (!trimmed) return null;
    
    if (trimmed.startsWith('### ')) {
      return <h4 key={paraIdx} className="text-xs font-bold text-slate-100 mt-2 mb-1">{renderInlineStyles(trimmed.substring(4))}</h4>;
    }
    if (trimmed.startsWith('## ')) {
      return <h3 key={paraIdx} className="text-sm font-bold text-slate-100 mt-2 mb-1">{renderInlineStyles(trimmed.substring(3))}</h3>;
    }
    if (trimmed.startsWith('# ')) {
      return <h2 key={paraIdx} className="text-base font-bold text-slate-100 mt-2.5 mb-1.5">{renderInlineStyles(trimmed.substring(2))}</h2>;
    }
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote key={paraIdx} className="border-l-2 border-blue-500 bg-blue-500/5 px-2 py-1 my-1 rounded-r italic text-slate-400">
          {renderInlineStyles(trimmed.substring(2))}
        </blockquote>
      );
    }
    
    const lines = trimmed.split('\n');
    const isList = lines.every(line => /^\s*([-*]|\d+\.)\s+/.test(line));
    
    if (isList) {
      const isOrdered = /^\s*\d+\.\s+/.test(lines[0]);
      const items = lines.map((line, lineIdx) => {
        const content = line.replace(/^\s*([-*]|\d+\.)\s+/, '');
        return <li key={lineIdx} className="mb-0.5">{renderInlineStyles(content)}</li>;
      });
      
      if (isOrdered) {
        return <ol key={paraIdx} className="list-decimal pl-4 mb-1.5 space-y-0.5">{items}</ol>;
      } else {
        return <ul key={paraIdx} className="list-disc pl-4 mb-1.5 space-y-0.5">{items}</ul>;
      }
    }
    
    return (
      <p key={paraIdx} className="mb-1">
        {lines.map((line, lineIdx) => (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && <br />}
            {renderInlineStyles(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
};

const renderFormattedContent = (text: string) => {
  if (!text) return null;
  const blocks: Array<{ type: 'text' | 'latex' | 'code'; content: string; lang?: string }> = [];
  let currentText = text;
  
  while (currentText.length > 0) {
    const latexStart = currentText.indexOf('$$');
    const codeStart = currentText.indexOf('```');
    
    if (latexStart === -1 && codeStart === -1) {
      blocks.push({ type: 'text', content: currentText });
      break;
    }
    
    if (latexStart !== -1 && (codeStart === -1 || latexStart < codeStart)) {
      if (latexStart > 0) {
        blocks.push({ type: 'text', content: currentText.substring(0, latexStart) });
      }
      const latexEnd = currentText.indexOf('$$', latexStart + 2);
      if (latexEnd === -1) {
        blocks.push({ type: 'latex', content: currentText.substring(latexStart + 2) });
        break;
      } else {
        blocks.push({ type: 'latex', content: currentText.substring(latexStart + 2, latexEnd) });
        currentText = currentText.substring(latexEnd + 2);
      }
    } else {
      if (codeStart > 0) {
        blocks.push({ type: 'text', content: currentText.substring(0, codeStart) });
      }
      const codeEnd = currentText.indexOf('```', codeStart + 3);
      if (codeEnd === -1) {
        blocks.push({ type: 'code', content: currentText.substring(codeStart + 3), lang: 'code' });
        break;
      } else {
        const fullCodeBlock = currentText.substring(codeStart + 3, codeEnd);
        const firstNewline = fullCodeBlock.indexOf('\n');
        let lang = 'code';
        let code = fullCodeBlock;
        if (firstNewline !== -1) {
          lang = fullCodeBlock.substring(0, firstNewline).trim() || 'code';
          code = fullCodeBlock.substring(firstNewline + 1);
        }
        blocks.push({ type: 'code', content: code.trim(), lang });
        currentText = currentText.substring(codeEnd + 3);
      }
    }
  }

  return (
    <div className="space-y-2 text-[11px] leading-relaxed text-slate-200">
      {blocks.map((block, idx) => {
        if (block.type === 'latex') {
          return (
            <div key={idx} className="flex justify-center items-center my-2.5 p-2.5 rounded-lg border border-slate-700/60 bg-slate-900/60 font-serif italic text-center tracking-wide text-xs text-slate-100">
              {renderLatexUnicode(block.content)}
            </div>
          );
        } else if (block.type === 'code') {
          return (
            <div key={idx} className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden my-2">
              <div className="flex justify-between items-center bg-slate-800 px-2.5 py-1 border-b border-slate-700 text-[9px] font-mono text-slate-400">
                <span>{block.lang}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(block.content);
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-650 text-slate-200 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="p-2.5 overflow-x-auto text-[10px] font-mono text-slate-200 leading-normal">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        } else {
          return (
            <div key={idx} className="space-y-1.5">
              {renderMarkdownTextBlock(block.content)}
            </div>
          );
        }
      })}
    </div>
  );
};

// Parses thinking blocks out of the text content inside React
function parseThinkingAndContent(text: string) {
  const thinkingParts: string[] = [];
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

// Generates a high-quality, valid mock JPEG browser screenshot to feed into Gemini API vision encoder
function generateMockScreenshot(title: string, url: string, text: string): string {
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
  ctx.fillText(url, 140, 34);

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
  ctx.fillText(title.charAt(0) || "W", 112, 208);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(title, 200, 180);

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
  const words = text.split(" ");
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

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulator" | "install" | "explorer">("simulator");
  const [activeFile, setActiveFile] = useState<string>("manifest.json");
  const [copied, setCopied] = useState<boolean>(false);

  // Simulator States
  const [simApiKey, setSimApiKey] = useState<string>("");
  const [simModel, setSimModel] = useState<string>("gemini-2.5-flash");
  const [simCustomModel, setSimCustomModel] = useState<string>("gemini-3.5-flash");
  const [simInput, setSimInput] = useState<string>("");
  const [simSettingsOpen, setSimSettingsOpen] = useState<boolean>(false);
  const [simShowKey, setSimShowKey] = useState<boolean>(false);
  const [simAttachment, setSimAttachment] = useState<any>(null);
  const [simPlusMenuOpen, setSimPlusMenuOpen] = useState<boolean>(false);
  
  // Multiple Chats in Simulator
  const [simChats, setSimChats] = useState<Array<any>>(() => {
    const saved = localStorage.getItem("simChats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      {
        id: "chat-default",
        title: "Chat 1",
        messages: [
          {
            id: 1,
            role: "assistant",
            text: "Hello! Paste your Gemini API key in the settings (⚙️) above to start. You can type prompts, upload files, or simulate taking page captures of this builder app!",
          }
        ]
      }
    ];
  });
  const [simActiveChatId, setSimActiveChatId] = useState<string>(() => {
    return localStorage.getItem("simActiveChatId") || "chat-default";
  });
  const [simChatsOpen, setSimChatsOpen] = useState<boolean>(false);
  const [simTabPickerOpen, setSimTabPickerOpen] = useState<boolean>(false);

  // Derive simMessages based on active chat
  const activeSimChat = simChats.find(c => c.id === simActiveChatId) || simChats[0];
  const simMessages = activeSimChat ? activeSimChat.messages : [];

  // Custom setSimMessages interceptor to update active chat
  const setSimMessages = (updater: any) => {
    setSimChats(prevChats => {
      const updated = prevChats.map(chat => {
        if (chat.id === simActiveChatId) {
          const currentMsgs = chat.messages || [];
          const newMessages = typeof updater === "function" ? updater(currentMsgs) : updater;
          
          let newTitle = chat.title;
          if (chat.title === "New Chat" || chat.title.startsWith("Chat ")) {
            const firstUser = newMessages.find((m: any) => m.role === "user");
            if (firstUser && firstUser.text) {
              let rawText = firstUser.text.trim();
              if (rawText.includes("DOM innerText Context")) {
                const index = rawText.indexOf("User Prompt:");
                if (index !== -1) {
                  rawText = rawText.substring(index + 12).trim();
                }
              }
              newTitle = rawText.substring(0, 25) || "New Chat";
            }
          }
          
          return {
            ...chat,
            title: newTitle,
            messages: newMessages
          };
        }
        return chat;
      });
      localStorage.setItem("simChats", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    localStorage.setItem("simActiveChatId", simActiveChatId);
  }, [simActiveChatId]);

  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simGenerating, setSimGenerating] = useState<boolean>(false);
  const simAbortControllerRef = useRef<AbortController | null>(null);
  const simTimeoutRef = useRef<any>(null);
  
  const simChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (simChatEndRef.current) {
      simChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [simMessages, simLoading]);

  // Copy code utility
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // File Upload simulation in simulator
  const handleSimFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = (file.size / 1024).toFixed(1) + " KB";
    const isImg = file.type.startsWith("image/");
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      setSimAttachment({
        name: file.name,
        size: sizeStr,
        type: file.type,
        isImage: isImg,
        base64: evt.target?.result as string
      });
    };
    reader.readAsDataURL(file);
    setSimPlusMenuOpen(false);
  };

  // Screen/DOM Capture simulation in simulator
  const handleSimScreenCapture = () => {
    setSimPlusMenuOpen(false);
    setSimTabPickerOpen(true);
  };

  const SIM_MOCK_TABS = [
    {
      id: 1,
      title: "Gemini Extension Builder",
      url: "https://gemini-extension-builder.ai.studio",
      icon: "🛠️",
      screenshot: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
      text: "Gemini Extension Builder is an advanced workbench to package custom Manifest V3 extensions. The app facilitates in-browser compilation of manifest.json, popup.html, popup.css, and popup.js into a packed ZIP folder. Built on June 2026, it uses React, Tailwind v4 and local JSZip compiler."
    },
    {
      id: 2,
      title: "Google Search - Gemini API Documentation",
      url: "https://www.google.com/search?q=gemini+api+documentation",
      icon: "🔍",
      screenshot: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
      text: "Search Results for Gemini API:\n1. Gemini API Overview - Google AI for Developers.\n2. GitHub - google-gemini/nanofsu: TypeScript SDK for the Gemini API.\n3. Build Extensions using the Gemini API - Manifest V3 Developer Guide."
    },
    {
      id: 3,
      title: "Gemini API Documentation & Guides",
      url: "https://ai.google.dev/gemini-api/docs",
      icon: "📕",
      screenshot: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=400&q=80",
      text: "Welcome to the Gemini API developer guides. Learn how to construct multi-modal content prompts, run streaming chats, enable code execution tools, and use advanced thinking models with think levels. Let's build stateful or stateless browser integrations today!"
    },
    {
      id: 4,
      title: "TechCrunch - AI Innovations in 2026",
      url: "https://techcrunch.com/2026/06/gemini-unveils-new-thinking-features",
      icon: "📰",
      screenshot: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80",
      text: "TechCrunch: Google Gemini introduces highly transparent 'thinking' blocks for client-side side panel extensions. The new SDK provides structured 'thought' blocks within JSON stream chunks, yielding massive reasoning speedups and giving developers deep observability into multi-step agent actions."
    }
  ];

  const handleSelectSimTab = (tab: typeof SIM_MOCK_TABS[0]) => {
    setSimTabPickerOpen(false);
    setSimLoading(true);
    
    setTimeout(() => {
      setSimAttachment({
        name: `Capture: ${tab.title}`,
        size: "Current Webpage (DOM + HTML)",
        type: "image/jpeg",
        isImage: true,
        base64: tab.screenshot,
        domContext: {
          title: tab.title,
          url: tab.url,
          text: tab.text
        }
      });
      setSimInput(`Explain or analyze this "${tab.title}" page for me.`);
      setSimLoading(false);
    }, 600);
  };

  // Stop message generation in simulator
  const handleSimStop = () => {
    if (simAbortControllerRef.current) {
      simAbortControllerRef.current.abort();
    }
    if (simTimeoutRef.current) {
      clearTimeout(simTimeoutRef.current);
    }
    setSimGenerating(false);
    setSimLoading(false);
  };

  // Send message in simulator
  const handleSimSend = async () => {
    if (!simInput.trim() && !simAttachment) return;

    const userMsgText = simInput;
    const currentAttach = simAttachment;

    const userMsg = {
      id: Date.now(),
      role: "user",
      text: userMsgText || "[Sent Attachment]",
      attachment: currentAttach
    };

    const updatedMessages = [...simMessages, userMsg];
    setSimMessages(updatedMessages);
    setSimInput("");
    setSimAttachment(null);

    const activeModelId = simModel === "custom" ? simCustomModel : simModel;

    if (simApiKey) {
      setSimLoading(true);
      setSimGenerating(true);
      
      const controller = new AbortController();
      simAbortControllerRef.current = controller;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModelId}:streamGenerateContent?key=${simApiKey}`;
        
        // Prepare whole history
        const chatHistoryForApi = updatedMessages.slice(0, -1).map(msg => {
          if (msg.role === "user") {
            const parts: any[] = [];
            let textToQuery = msg.text;
            if (msg.attachment) {
              if (msg.attachment.domContext) {
                textToQuery = `[Captured Webpage Context URL: ${msg.attachment.domContext.url}]\n\nDOM content:\n---\n${msg.attachment.domContext.text}\n---\n\nUser Question: ${msg.text || "Analyze this webpage"}`;
              }
              if (msg.attachment.base64 && msg.attachment.base64.startsWith("data:")) {
                parts.push({
                  inlineData: {
                    mimeType: msg.attachment.type || "image/jpeg",
                    data: msg.attachment.base64.split(",")[1]
                  }
                });
              }
            }
            parts.push({ text: textToQuery });
            return { role: "user", parts };
          } else {
            return { role: "model", parts: [{ text: msg.text }] };
          }
        });

        // Add current user prompt
        const currentParts: any[] = [];
        let currentText = userMsgText;
        if (currentAttach) {
          if (currentAttach.domContext) {
            currentText = `[Captured Webpage Context URL: ${currentAttach.domContext.url}]\n\nDOM content:\n---\n${currentAttach.domContext.text}\n---\n\nUser Question: ${userMsgText || "Analyze this webpage"}`;
          }
          if (currentAttach.base64 && currentAttach.base64.startsWith("data:")) {
            currentParts.push({
              inlineData: {
                mimeType: currentAttach.type,
                data: currentAttach.base64.split(",")[1]
              }
            });
          }
        }
        currentParts.push({ text: currentText || "Analyze attachment" });
        chatHistoryForApi.push({ role: "user", parts: currentParts });

        let hasMoreTurns = true;
        let localHistory = [...chatHistoryForApi];

        while (hasMoreTurns) {
          hasMoreTurns = false;
          let activeFunctionCall: any = null;

          // Optimize history: strip massive base64 inlineData from all past turns to prevent token bloat
          const optimizedHistory = localHistory.map((msg, idx) => {
            const isPastTurn = idx < localHistory.length - 1;
            const cleanParts = msg.parts.map((part: any) => {
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

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: optimizedHistory,
              systemInstruction: {
                parts: [{
                  text: "You are Gemini Web Companion, an advanced browser assistant Chrome Extension.\nYou help users analyze web pages, answer questions, and perform research.\nYou can call 'get_page_dom' to get webpage text, 'get_page_screenshot' to get a visual screenshot, 'click_element' to interact with buttons/links, and 'type_text' to fill out input fields.\n\nCRITICAL RULES:\n- Always output your internal step-by-step planning and thinking process enclosed exactly within <thinking> and </thinking> tags at the very start of your response.\n- Never output raw base64 data, gibberish strings, or repeating binary characters.\n- If you call 'get_page_screenshot', you will receive the screenshot image as inlineData in the next user turn. Analyze the screenshot visually and describe it naturally.\n- Keep explanations conversational, elegant, and markdown-formatted."
                }]
              },
              tools: [{
                functionDeclarations: [
                  {
                    name: "get_page_dom",
                    description: "Retrieves the webpage text context, title, and URL of the active browser tab to answer user context questions.",
                    parameters: { type: "OBJECT", properties: {} }
                  },
                  {
                    name: "get_page_screenshot",
                    description: "Captures a visual screenshot of the current visible tab's viewport as base64 JPEG image data.",
                    parameters: { type: "OBJECT", properties: {} }
                  },
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
                    name: "type_text",
                    description: "Types text into an input or textarea on the webpage of the active browser tab.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        selector: {
                          type: "STRING",
                          description: "CSS selector of the input/textarea to type into (e.g. 'input[type=\"text\"]', '#search-input', '.prompt-text')."
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
                  }
                ]
              }]
            })
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
          }

          if (!response.body) {
            throw new Error("ReadableStream not supported on this browser.");
          }

          setSimLoading(false);

          // Add a new assistant message bubble for this turn
          const turnMsgId = Date.now() + Math.random();
          setSimMessages((prev) => [
            ...prev,
            {
              id: turnMsgId,
              role: "assistant",
              text: ""
            }
          ]);

          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let accumulatedText = "";
          let buffer = "";
          let inThinkingBlock = false;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            let b = 0;
            while (b < buffer.length) {
              const startIdx = buffer.indexOf('{', b);
              if (startIdx === -1) break;

              let bracketCount = 0;
              let endIdx = -1;
              let inString = false;
              let escape = false;

              for (let i = startIdx; i < buffer.length; i++) {
                const char = buffer[i];
                if (escape) { escape = false; continue; }
                if (char === '\\') { escape = true; continue; }
                if (char === '"') { inString = !inString; continue; }
                if (!inString) {
                  if (char === '{') bracketCount++;
                  else if (char === '}') {
                    bracketCount--;
                    if (bracketCount === 0) { endIdx = i; break; }
                  }
                }
              }

              if (endIdx !== -1) {
                const jsonStr = buffer.substring(startIdx, endIdx + 1);
                try {
                  const obj = JSON.parse(jsonStr);
                  const parts = obj.candidates?.[0]?.content?.parts;
                  if (parts) {
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
                        setSimMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === turnMsgId ? { ...msg, text: accumulatedText } : msg
                          )
                        );
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
            setSimMessages((prev) =>
              prev.map((msg) =>
                msg.id === turnMsgId ? { ...msg, text: accumulatedText } : msg
              )
            );
          }

          if (activeFunctionCall) {
            hasMoreTurns = true;

            // 1. Save model function call to local history (preserving generated thoughts/text)
            const modelParts: any[] = [];
            if (accumulatedText.trim()) {
              modelParts.push({ text: accumulatedText });
            }
            modelParts.push({ functionCall: activeFunctionCall });
            localHistory.push({
              role: "model",
              parts: modelParts
            });

            // 2. Execute tool inside simulator
            let toolOutput: any = null;
            if (activeFunctionCall.name === "get_page_dom") {
              const defaultTab = SIM_MOCK_TABS[0];
              const title = simAttachment?.domContext?.title || defaultTab.title;
              const url = simAttachment?.domContext?.url || defaultTab.url;
              const text = simAttachment?.domContext?.text || defaultTab.text;
              toolOutput = {
                success: true,
                title,
                url,
                text
              };
            } else if (activeFunctionCall.name === "get_page_screenshot") {
              toolOutput = {
                success: true,
                width: 1280,
                height: 720,
                message: "Screenshot captured successfully and attached as an image part. Please analyze the image visually to answer."
              };
            } else if (activeFunctionCall.name === "click_element") {
              const sel = activeFunctionCall.args?.selector || "";
              const txt = activeFunctionCall.args?.textContext || "";
              let elements: HTMLElement[] = [];
              if (sel) {
                try {
                  elements = Array.from(document.querySelectorAll(sel));
                } catch (e) {}
              } else if (txt) {
                elements = Array.from(document.querySelectorAll("button, a, input, [role='button'], span, p, div")) as HTMLElement[];
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
                  toolOutput = {
                    success: true,
                    tagName: target.tagName,
                    id: target.id,
                    text: (target.textContent || "").substring(0, 50).trim(),
                    message: `[Simulator] Found and clicked <${target.tagName.toLowerCase()}> element on current screen.`
                  };
                } catch (err: any) {
                  toolOutput = { success: false, error: err.message };
                }
              } else {
                toolOutput = {
                  success: true,
                  message: `[Simulator Fallback] Element matching '${sel || txt}' clicked successfully in virtual space.`
                };
              }
            } else if (activeFunctionCall.name === "type_text") {
              const sel = activeFunctionCall.args?.selector || "";
              const txt = activeFunctionCall.args?.text || "";
              let target: any = null;
              try {
                target = document.querySelector(sel);
              } catch (e) {}

              if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                try {
                  target.focus();
                  if (target.isContentEditable) {
                    target.innerText = txt;
                  } else {
                    target.value = txt;
                  }
                  target.dispatchEvent(new Event('input', { bubbles: true }));
                  target.dispatchEvent(new Event('change', { bubbles: true }));
                  toolOutput = {
                    success: true,
                    tagName: target.tagName,
                    id: target.id,
                    message: `[Simulator] Typed "${txt}" into input field on current screen.`
                  };
                } catch (err: any) {
                  toolOutput = { success: false, error: err.message };
                }
              } else {
                toolOutput = {
                  success: true,
                  message: `[Simulator Fallback] Typed "${txt}" into virtual input field matching '${sel}'.`
                };
              }
            }

            // Append status note to the assistant's text
            let responseNote = "Context successfully loaded!";
            if (activeFunctionCall.name === "click_element") {
              responseNote = `Element clicked successfully!`;
            } else if (activeFunctionCall.name === "type_text") {
              responseNote = `Typed text: "${activeFunctionCall.args?.text || ""}"`;
            }
            const textWithTool = accumulatedText + `\n\n⚙️ *Called tool: ${activeFunctionCall.name}()*\n⚙️ *Response:* ${responseNote}`;
            setSimMessages((prev) =>
              prev.map((msg) =>
                msg.id === turnMsgId ? { ...msg, text: textWithTool } : msg
              )
            );

            // 3. Save function response to local history
            const responseParts: any[] = [
              {
                functionResponse: {
                  name: activeFunctionCall.name,
                  response: toolOutput
                }
              }
            ];

            if (activeFunctionCall.name === "get_page_screenshot") {
              const defaultTab = SIM_MOCK_TABS[0];
              const tabTitle = simAttachment?.domContext?.title || defaultTab.title;
              const tabUrl = simAttachment?.domContext?.url || defaultTab.url;
              const tabText = simAttachment?.domContext?.text || defaultTab.text;
              const base64Url = generateMockScreenshot(tabTitle, tabUrl, tabText);
              const cleanBase64 = base64Url.split(",")[1];
              responseParts.push({
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64
                }
              });
            }

            localHistory.push({
              role: "user",
              parts: responseParts
            });

            // Set loading spinner back on
            setSimLoading(true);
            await new Promise((r) => setTimeout(r, 600)); // smooth delay
          } else {
            // standard end of generation
            localHistory.push({
              role: "model",
              parts: [{ text: accumulatedText }]
            });
          }
        }

        setSimGenerating(false);

      } catch (e: any) {
        setSimLoading(false);
        setSimGenerating(false);
        if (e.name === "AbortError") {
          setSimMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              role: "assistant",
              text: "⚠️ *Generation stopped by user.*"
            }
          ]);
        } else {
          setSimMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              role: "assistant",
              text: `❌ **API Connection Error:** ${e.message || "Could not query Gemini API."}\n\nMake sure your pasted API Key is valid and that you have unrestricted network access to \`generativelanguage.googleapis.com\`.`
            }
          ]);
        }
      }
    } else {
      setSimLoading(true);
      setSimGenerating(true);
      simTimeoutRef.current = setTimeout(() => {
        setSimGenerating(false);
        let mockResponse = "";
        if (currentAttach && currentAttach.domContext) {
          mockResponse = `<thinking>Analyzing current webpage context and DOM structure...
- DOM context contains webpage Title and innerText
- Retrieved capture reference image
- Evaluating page hierarchy and summarizing key details</thinking>🔮 **[SIMULATED GEMINI RESPONSE]**

I successfully analyzed the DOM content and screenshot you captured!

**Website Analysis Summary:**
- **Page Title:** ${currentAttach.domContext.title}
- **Source URL:** ${currentAttach.domContext.url}

**Identified Page Content:**
"${currentAttach.domContext.text.substring(0, 150)}..."

**How to Run Live Requests:**
If you paste your real API key into the simulator's settings tab (click ⚙️ above), I will make a live request to the Google GenAI endpoints to prove how the model parses the website structure!`;
        } else if (currentAttach) {
          mockResponse = `<thinking>Processing user-uploaded document: ${currentAttach.name}...
- Extracted content structure
- Preparing summaries</thinking>🔮 **[SIMULATED GEMINI RESPONSE]**

I successfully processed your uploaded file **"${currentAttach.name}"** (${currentAttach.size}).

To run real visual image queries and receive actual text generations, paste your real Gemini API key into the simulator settings panel (⚙️) above! Once pasted, the simulator executes direct, serverless API calls to **${activeModelId}** from your browser!`;
        } else {
          mockResponse = `<thinking>User prompted: "${userMsgText}"
- Interpreting core request
- Formulating instructions to load and use the browser extension</thinking>🔮 **[SIMULATED GEMINI RESPONSE]**

I received your query: *"${userMsgText}"*

**How this works:**
This simulator mimics the exact behavior of the Chrome Extension you will load. To test real Gemini capabilities directly in this preview:
1. Click the gear icon (**⚙️**) inside this phone mock-up.
2. Paste your Gemini API key from Google AI Studio.
3. Type any question, and the simulator will connect directly to **${activeModelId}** for a fully responsive, real-time conversation!

To install this tool directly into your Chrome browser, check out the **Installation Guide** tab!`;
        }

        setSimMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: mockResponse
          }
        ]);
        setSimLoading(false);
      }, 1200);
    }
  };

  const getFileCode = () => {
    switch (activeFile) {
      case "manifest.json": return MANIFEST_CODE;
      case "popup.html": return POPUP_HTML_CODE;
      case "popup.css": return POPUP_CSS_CODE;
      case "popup.js": return POPUP_JS_CODE;
      case "background.js": return BACKGROUND_CODE;
      default: return "";
    }
  };

  const getFileDesc = () => {
    switch (activeFile) {
      case "manifest.json":
        return "Declares the chrome extension's permissions, Manifest V3 schemas, icons, and background workers.";
      case "popup.html":
        return "Defines the structures, panels, and forms inside the collapsible extension widget.";
      case "popup.css":
        return "Styles the visual layout, custom scrollbar, glow-effects, and chat bubble systems with modern dark values.";
      case "popup.js":
        return "Drives settings synchronization in chrome storage, file serialization to base64, tab captures, and Gemini endpoints.";
      case "background.js":
        return "A lightweight Manifest V3 background service worker to initialize local state configurations.";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased pb-20">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/15 via-violet-900/5 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-blue-500/5 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-80 left-10 w-96 h-96 bg-violet-500/5 blur-3xl pointer-events-none -z-10" />

      {/* Hero Header Section */}
      <header className="max-w-6xl mx-auto px-6 pt-12 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-slate-800 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Manifest V3 Compliant
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Chrome Extension Ready
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
              Gemini Browser Extension
            </h1>
            <p className="mt-2 text-slate-400 max-w-3xl text-sm md:text-base leading-relaxed">
              This repository contains the completed, fully built Chrome Extension! All of the files (including <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded text-xs">manifest.json</code>, <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded text-xs">popup.html</code>, <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded text-xs">popup.js</code>, and <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded text-xs">icon.svg</code>) exist directly in the root folder of this codebase. 
            </p>
          </div>
        </div>

        {/* Highlighted Warning of direct usage */}
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20 text-slate-300 text-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-3 items-start">
            <span className="text-2xl mt-0.5">📥</span>
            <div>
              <h3 className="text-white font-semibold">How to Download and Load This Extension:</h3>
              <p className="text-slate-400 text-xs mt-1">
                Simply click the <strong>AI Studio export menu</strong> in the top-right corner, select <strong>Export to ZIP</strong> (or export to GitHub), extract the downloaded ZIP folder on your computer, and load the root directory directly in Chrome! No building or extra command tools needed.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Navigation Tabs and Worksheets */}
        <section className="lg:col-span-5 space-y-6">
          
          {/* Navigation Controls */}
          <div className="flex items-center bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab("simulator")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "simulator"
                  ? "bg-slate-800 text-white border-b border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Laptop className="w-4 h-4" />
              Live Interactive Simulator
            </button>
            <button
              onClick={() => setActiveTab("install")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "install"
                  ? "bg-slate-800 text-white border-b border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Installation Steps
            </button>
            <button
              onClick={() => setActiveTab("explorer")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "explorer"
                  ? "bg-slate-800 text-white border-b border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileCode className="w-4 h-4" />
              Inspect Source Code
            </button>
          </div>

          {/* TAB CONTENT: SIMULATOR EXPLANATION */}
          {activeTab === "simulator" && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Try the Live Extension Mockup!
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Interact with the phone shell on the right. It operates exactly like your downloaded Chrome Extension will:
              </p>
              <ul className="space-y-3.5 text-slate-400 text-sm pl-1">
                <li className="flex gap-2 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  <span><strong>Config Settings (⚙️):</strong> Click the gear icon inside the mockup to paste your <strong>Gemini API key</strong> and select a model.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  <span><strong>Attach Documents & Content (+):</strong> Click the plus icon to upload documents or simulate a visual tab capture along with the webpage DOM text contents!</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  <span><strong>No API Key yet?</strong> No problem! Send a query anyway, and the simulator will display a detailed explanation of how it parses page hierarchies and forwards payload contexts to Gemini.</span>
                </li>
              </ul>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-blue-300 text-xs leading-relaxed">
                💡 <strong>Privacy First:</strong> Your custom API key is stored purely locally inside your browser's context or extension storage. No third-party relays, servers, or intermediaries ever see your credentials.
              </div>
            </div>
          )}

          {/* TAB CONTENT: INSTALLATION GUIDE */}
          {activeTab === "install" && (
            <div className="space-y-4">
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
                <h3 className="font-display text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Puzzle className="w-5 h-5 text-blue-400" />
                  Interactive Extension Installation Guide
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Step 1 */}
                  <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Step 1</span>
                      <span className="text-xs font-mono text-slate-500">ZIP</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm">Export ZIP from AI Studio</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Click the settings menu in the top-right corner of Google AI Studio and download this workspace as a compressed ZIP.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Step 2</span>
                      <FolderOpen className="w-4 h-4 text-slate-500" />
                    </div>
                    <h4 className="font-semibold text-white text-sm">Extract Files</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Locate the downloaded `.zip` file on your computer and extract (unzip) it into a dedicated folder on your drive.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Step 3</span>
                      <span className="text-xs font-mono text-slate-500">chrome://</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm">Open Extensions</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Launch your Google Chrome browser, type <code className="text-blue-300 font-mono text-xs select-all">chrome://extensions</code> in the address bar, and press Enter.
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Step 4</span>
                      <div className="w-5 h-3 bg-blue-500 rounded-full relative"><div className="w-2.5 h-2.5 bg-white rounded-full absolute right-0.5 top-0.5" /></div>
                    </div>
                    <h4 className="font-semibold text-white text-sm">Developer Mode</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      In the top-right corner of the Extensions page, switch the <strong>"Developer Mode"</strong> toggle to the **ON** position.
                    </p>
                  </div>

                  {/* Step 5 */}
                  <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-2 col-span-1 sm:col-span-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Step 5</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h4 className="font-semibold text-white text-sm">Click "Load Unpacked"</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Click the <strong>"Load unpacked"</strong> button in the top-left menu bar. Select the root folder where you extracted the project. Chrome will install it immediately!
                    </p>
                  </div>

                </div>

                <div className="mt-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/15 text-slate-300 text-xs flex gap-3 items-start">
                  <span className="text-lg">📌</span>
                  <p className="leading-relaxed">
                    <strong>Quick Tip:</strong> Click the puzzle-piece icon on your Chrome toolbar, find <strong>"Gemini Web Companion"</strong>, and click the pin icon. This places the glowing sparkle button directly in your browser bar for single-click access!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: CODE EXPLORER */}
          {activeTab === "explorer" && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-blue-400" />
                  Code Explorer
                </h3>
                <button
                  onClick={() => handleCopy(getFileCode())}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy Code"}
                </button>
              </div>

              {/* File selection Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
                {["manifest.json", "popup.html", "popup.css", "popup.js", "background.js"].map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setActiveFile(fileName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                      activeFile === fileName
                        ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                        : "bg-slate-900/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {fileName}
                  </button>
                ))}
              </div>

              {/* File Info */}
              <p className="text-xs text-slate-400 leading-relaxed italic">
                {getFileDesc()}
              </p>

              {/* Code Panel */}
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-4">
                <pre className="overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-300 max-h-[400px]">
                  <code>{getFileCode()}</code>
                </pre>
              </div>
            </div>
          )}

        </section>

        {/* Right Side: Extension Screen Simulator Shell */}
        <section className="lg:col-span-7 flex justify-center w-full">
          {/* Desktop Browser Mockup Container */}
          <div className="w-full max-w-[680px] bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[580px] relative">
            
            {/* macOS / Chrome Title Bar Bar */}
            <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between gap-2 shrink-0 border-b border-slate-800/80 select-none">
              {/* Traffic Lights */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-2.5 h-2.5 bg-red-500/80 rounded-full" />
                <div className="w-2.5 h-2.5 bg-yellow-500/80 rounded-full" />
                <div className="w-2.5 h-2.5 bg-green-500/80 rounded-full" />
              </div>
              
              {/* Browser Tabs */}
              <div className="flex items-center gap-1 flex-1 max-w-sm ml-4 text-left">
                <div className="bg-slate-900 border-t border-x border-slate-800/80 px-2.5 py-1 rounded-t-md text-[9px] text-slate-300 font-medium truncate flex items-center gap-1.5 shadow-sm">
                  <span className="text-blue-400">✨</span>
                  <span>Gemini Web Companion</span>
                </div>
                <div className="hidden sm:block text-[9px] text-slate-500 px-2 py-1 hover:text-slate-400 truncate cursor-pointer">
                  Google AI Studio
                </div>
              </div>

              {/* Window Utilities */}
              <div className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                <span>✕</span> <span>―</span> <span>▢</span>
              </div>
            </div>

            {/* Browser Control Bar (Address Bar + Extensions) */}
            <div className="bg-slate-900 px-4 py-1.5 flex items-center gap-3 shrink-0 border-b border-slate-800/80 select-none">
              <div className="flex items-center gap-2 text-slate-500">
                <span className="text-xs font-semibold cursor-pointer hover:text-slate-300">←</span>
                <span className="text-xs font-semibold cursor-pointer hover:text-slate-300">→</span>
                <RotateCw className="w-2.5 h-2.5 cursor-pointer hover:text-slate-300" />
              </div>

              {/* Address bar */}
              <div className="bg-slate-950 border border-slate-850 rounded-md px-3 py-0.5 flex items-center gap-2 flex-1 text-left">
                <Globe className="w-2.5 h-2.5 text-slate-500" />
                <span className="text-[9px] text-slate-400 font-mono truncate select-all flex-1">https://ai.google.dev/blog/gemini-web-companion</span>
              </div>

              {/* Extension Bar Icons */}
              <div className="flex items-center gap-2 text-slate-400">
                <Puzzle className="w-3.5 h-3.5 hover:text-slate-200 cursor-pointer" title="Extensions" />
                {/* Glowing Sparkles button representing our Sidepanel Extension Action */}
                <div className="relative">
                  <button 
                    className="p-1 bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/30 rounded text-blue-400 hover:text-blue-300 transition animate-pulse cursor-pointer flex items-center justify-center"
                    title="Open Gemini Companion Side Panel"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>

            {/* Split Screen Viewport: Mock Webpage on Left, Docked Side Panel on Right */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* LEFT SIDE: Mock Article Webpage */}
              <div className="hidden sm:flex sm:flex-col sm:flex-1 bg-slate-950 p-4 overflow-y-auto select-none border-r border-slate-800/80 text-left">
                <div className="border-b border-slate-800 pb-3 mb-3">
                  <div className="text-blue-500 font-mono text-[9px] uppercase font-bold tracking-wider">Research Article</div>
                  <h2 className="text-sm font-bold text-white mt-1 leading-snug">
                    How Gemini Models are Reshaping Browser Workflows
                  </h2>
                  <div className="text-[9px] text-slate-500 mt-1">Published June 2026 • 4 min read</div>
                </div>

                <div className="space-y-3 text-[11px]">
                  <p className="text-slate-300 leading-relaxed">
                    Traditional web browsers were built as static document viewers. However, the integration of 
                    <span className="bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded font-medium mx-1">Manifest V3 Side Panels</span>
                    and high-context models transforms them into active runtime workspaces.
                  </p>
                  
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-400 leading-relaxed border-l-2 border-l-blue-500 font-serif italic">
                    "The standard popup extension closes as soon as the user clicks anywhere else. 
                    By migrating to a <strong>persistent side panel layout</strong>, Gemini remains actively 
                    docked next to your browsing viewport."
                  </div>

                  <p className="text-slate-300 leading-relaxed">
                    This sidebar is fully context-aware. With a single click, users can capture the page DOM 
                    or query visual layouts directly.
                  </p>

                  {/* Simulated webpage highlight */}
                  <div className="p-2.5 bg-blue-950/20 border border-blue-500/20 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wide">Target Webpage Scraped DOM:</span>
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded font-mono">Ready</span>
                    </div>
                    <div className="text-slate-400 text-[9px] font-mono leading-relaxed bg-slate-950 p-1.5 rounded border border-slate-900/60 max-h-[80px] overflow-y-auto">
                      Title: Reshaping Browser Workflows<br />
                      URL: https://ai.google.dev/blog/gemini-web-companion<br />
                      DOM Text: Manifest V3 Side Panels and high-context models transform browsers into active runtime workspaces...
                    </div>
                  </div>

                  <button 
                    onClick={handleSimScreenCapture}
                    className="w-full py-2 bg-gradient-to-r from-blue-600/90 to-violet-600/90 hover:from-blue-600 hover:to-violet-600 text-white font-medium rounded-md transition text-[10px] flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span>📸</span>
                    <span>Simulate Page Capture in Sidebar</span>
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: The Gemini Side Panel (Sidebar) */}
              <div className="w-full sm:w-[280px] md:w-[310px] bg-slate-900 flex flex-col h-full relative shrink-0">
                {/* Simulated Extension Header */}
                <header className="flex justify-between items-center px-3.5 py-2.5 bg-slate-800 border-b border-slate-700/60 shrink-0 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 text-xs">✨</span>
                    <span className="text-[11px] font-semibold text-slate-200">Gemini Companion Side Panel</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSimChatsOpen(!simChatsOpen);
                        setSimSettingsOpen(false);
                      }}
                      className={`p-1 rounded text-slate-400 hover:text-slate-100 transition cursor-pointer ${simChatsOpen ? "bg-slate-700 text-white" : ""}`}
                      title="My Chats"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSimSettingsOpen(!simSettingsOpen);
                        setSimChatsOpen(false);
                      }}
                      className={`p-1 rounded text-slate-400 hover:text-slate-100 transition cursor-pointer ${simSettingsOpen ? "bg-slate-700 text-white" : ""}`}
                      title="Settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </header>

                {/* Simulated Chats Window */}
                {simChatsOpen && (
                  <div className="absolute top-[38px] left-0 w-full bg-slate-800 border-b border-slate-700 px-3.5 py-3 z-30 space-y-2.5 shadow-xl text-left">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-1.5">
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">My Chats</h4>
                      <button
                        onClick={() => {
                          const newChat = {
                            id: "chat-" + Date.now(),
                            title: `New Chat`,
                            messages: [
                              {
                                id: Date.now(),
                                role: "assistant",
                                text: "New chat started! Ask anything or upload page capture contexts."
                              }
                            ]
                          };
                          const updated = [newChat, ...simChats];
                          setSimChats(updated);
                          setSimActiveChatId(newChat.id);
                          localStorage.setItem("simChats", JSON.stringify(updated));
                          setSimChatsOpen(false);
                        }}
                        className="text-[9px] bg-blue-600 hover:bg-blue-500 text-white font-medium px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                      >
                        <Plus className="w-2.5 h-2.5" /> New Chat
                      </button>
                    </div>

                    <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                      {simChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => {
                            setSimActiveChatId(chat.id);
                            setSimChatsOpen(false);
                          }}
                          className={`flex justify-between items-center px-2 py-1.5 rounded text-[11px] cursor-pointer border transition ${
                            chat.id === simActiveChatId
                              ? "bg-slate-700 border-blue-500 text-slate-100"
                              : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-750"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-2">
                            <span className="text-blue-400/80">💬</span>
                            <span className="truncate font-medium">{chat.title}</span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (simChats.length <= 1) return;
                              const remaining = simChats.filter(c => c.id !== chat.id);
                              setSimChats(remaining);
                              localStorage.setItem("simChats", JSON.stringify(remaining));
                              if (simActiveChatId === chat.id) {
                                setSimActiveChatId(remaining[0].id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition hover:bg-slate-700/50"
                            title="Delete Chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Simulated Settings Window */}
                {simSettingsOpen && (
                  <div className="absolute top-[38px] left-0 w-full bg-slate-800 border-b border-slate-700 px-3.5 py-3 z-30 space-y-2 shadow-xl text-left">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-1.5">
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Settings Config</h4>
                      <button onClick={() => setSimSettingsOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-3 h-3" /></button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-medium text-slate-400">Gemini API Key</label>
                        <div className="flex gap-1">
                          <input
                            type={simShowKey ? "text" : "password"}
                            value={simApiKey}
                            onChange={(e) => setSimApiKey(e.target.value)}
                            placeholder="Paste your Gemini API Key..."
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 flex-1 outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => setSimShowKey(!simShowKey)}
                            className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                          >
                            {simShowKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-medium text-slate-400">Select Model</label>
                        <select
                          value={simModel}
                          onChange={(e) => setSimModel(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-100 outline-none focus:border-blue-500"
                        >
                          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                          <option value="custom">-- Custom Model --</option>
                        </select>
                      </div>

                      {simModel === "custom" && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-medium text-slate-400">Custom Model ID</label>
                          <input
                            type="text"
                            value={simCustomModel}
                            onChange={(e) => setSimCustomModel(e.target.value)}
                            placeholder="e.g. gemini-3.5-flash"
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-100 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setSimSettingsOpen(false);
                          setSimMessages((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              role: "assistant",
                              text: simApiKey 
                                ? "✅ API Key saved! You can now send real queries directly to Gemini models."
                                : "⚠️ No API Key entered. Real connections are paused; falling back to simulated analysis modes."
                            }
                          ]);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium rounded px-2.5 py-1 text-[10px] transition cursor-pointer"
                      >
                        Save Settings
                      </button>
                    </div>
                  </div>
                )}

                {/* Simulated Chat Feed Area */}
                <main className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-950 text-left">
                  
                  {/* Alert Warning for empty API Key in Simulator */}
                  {!simApiKey && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] leading-relaxed">
                      ⚠️ <strong>Real Gemini request mode is paused.</strong> Enter your key via settings (⚙️) above for live model generation.
                    </div>
                  )}

                  {simMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] rounded-xl px-2.5 py-2 text-[11px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white self-end rounded-br-none"
                          : "bg-slate-800 text-slate-200 border border-slate-700/60 self-start rounded-bl-none"
                      }`}
                    >
                      {/* Rendering Simulated Attachment inside Bubble */}
                      {msg.attachment && (
                        <div className="mb-2 bg-slate-950/40 p-1 rounded-md border border-white/5 flex items-center gap-1 text-[9px]">
                          <span>{msg.attachment.isImage ? "🖼️" : "📄"}</span>
                          <span className="truncate flex-1 font-medium">{msg.attachment.name}</span>
                        </div>
                      )}

                      {/* Rendering text with details component for collapsible reasoning */}
                      {(() => {
                        if (msg.role === "assistant") {
                          const parsed = parseThinkingAndContent(msg.text);
                          const isStillStreaming = msg.text.indexOf("</thinking>") === -1;
                          return (
                            <div className="space-y-1.5">
                              {parsed.thinking && (
                                <div className="border border-dashed border-blue-500/25 rounded-lg bg-slate-900/50 overflow-hidden text-left">
                                  <details className="group" open={isStillStreaming}>
                                    <summary className="flex items-center justify-between px-2 py-1 bg-blue-500/5 text-blue-300 font-medium text-[9px] cursor-pointer hover:bg-blue-500/10 outline-none select-none">
                                      <span className="flex items-center gap-1">
                                        <span className="inline-block animate-pulse">🧠</span>
                                        <span>Thinking Process</span>
                                      </span>
                                      <span className="text-[7px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="p-1.5 font-mono text-[8px] text-slate-400 border-t border-blue-500/10 max-h-[100px] overflow-y-auto whitespace-pre-wrap">
                                      {parsed.thinking}
                                    </div>
                                  </details>
                                </div>
                              )}
                              {parsed.content ? (
                                <div className="text-left">{renderFormattedContent(parsed.content)}</div>
                              ) : (
                                parsed.thinking ? null : <p className="whitespace-pre-wrap">...</p>
                              )}
                            </div>
                          );
                        } else {
                          return <div className="text-left whitespace-pre-wrap">{renderFormattedContent(msg.text)}</div>;
                        }
                      })()}
                    </div>
                  ))}

                  {simLoading && (
                    <div className="bg-slate-800 text-slate-300 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] self-start rounded-bl-none flex items-center gap-1.5 max-w-[80%]">
                      <div className="w-2.5 h-2.5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                      <span className="animate-pulse">Gemini thinking...</span>
                    </div>
                  )}

                  <div ref={simChatEndRef} />
                </main>

                {/* Simulated Attachment Box */}
                {simAttachment && (
                  <div className="px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between gap-2 shrink-0 text-left select-none">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-xs">{simAttachment.isImage ? "🖼️" : "📄"}</span>
                      <div className="flex flex-col overflow-hidden text-[9px]">
                        <span className="text-slate-200 font-medium truncate">{simAttachment.name}</span>
                        <span className="text-slate-400 font-mono text-[8px]">{simAttachment.size}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSimAttachment(null)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Simulated Input Area */}
                <footer className="p-2.5 bg-slate-800 border-t border-slate-700 shrink-0 relative z-10">
                  <div className="flex items-center gap-1.5 relative">
                    
                    {/* Plus button trigger */}
                    <div className="relative">
                      <button
                        onClick={() => setSimPlusMenuOpen(!simPlusMenuOpen)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg hover:text-white transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {/* Plus Options Popover */}
                      {simPlusMenuOpen && (
                        <div className="absolute bottom-10 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-[200px] p-1 flex flex-col z-40 text-left">
                          <label className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white cursor-pointer transition">
                            <span>📁</span>
                            <span>Upload Custom File</span>
                            <input
                              type="file"
                              onChange={handleSimFileUpload}
                              className="hidden"
                            />
                          </label>
                          <button
                            onClick={handleSimScreenCapture}
                            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white text-left transition cursor-pointer"
                          >
                            <span>📸</span>
                            <span>Capture Screen + DOM</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Main simulated text bar */}
                    <input
                      type="text"
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSimSend();
                      }}
                      placeholder="Ask Gemini in side panel..."
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 flex-1 outline-none focus:border-blue-500"
                    />

                    {simGenerating ? (
                      <button
                        onClick={handleSimStop}
                        className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition shrink-0 cursor-pointer flex items-center justify-center animate-pulse"
                        title="Stop generation"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSimSend}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shrink-0 cursor-pointer flex items-center justify-center"
                        title="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}

                  </div>
                </footer>

              </div>
            </div>

          </div>
        </section>

      </main>

      {/* React Tab Picker Modal Overlay for Simulator */}
      {simTabPickerOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-[9999] p-4"
          onClick={() => setSimTabPickerOpen(false)}
        >
          <div 
            className="bg-slate-850 border border-slate-700/80 rounded-2xl w-full max-w-sm max-h-[420px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-700/60 bg-slate-800">
              <span className="font-semibold text-slate-100 text-xs flex items-center gap-2">
                <span className="text-base">📸</span> Select Tab to Capture
              </span>
              <button 
                onClick={() => setSimTabPickerOpen(false)}
                className="text-slate-400 hover:text-slate-100 text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-700/60 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Tab List */}
            <div className="p-3 overflow-y-auto space-y-2 max-h-[340px] bg-slate-900">
              {SIM_MOCK_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleSelectSimTab(tab)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/60 transition cursor-pointer text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base shrink-0 group-hover:bg-slate-700 transition">
                    {tab.icon}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-medium text-slate-100 text-xs truncate">
                      {tab.title}
                    </span>
                    <span className="text-slate-500 text-[10px] truncate font-mono">
                      {tab.url}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

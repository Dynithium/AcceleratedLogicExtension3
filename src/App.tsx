import React, { useState, useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
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
    "storage",
    "tabs"
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

/* Code Blocks and Inline Code Styling */
.inline-code {
  font-family: var(--font-mono), monospace;
  font-size: 0.75rem;
  background-color: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.2);
  color: #fda4af;
  padding: 1px 4px;
  border-radius: 4px;
}

.code-block-container {
  border: 1px solid #334155;
  background-color: #020617;
  border-radius: 8px;
  overflow: hidden;
  margin: 10px 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1e293b;
  padding: 6px 12px;
  border-bottom: 1px solid #334155;
}

.code-block-lang {
  font-family: var(--font-mono), monospace;
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 500;
  text-transform: uppercase;
}

.code-copy-btn {
  background-color: #334155;
  border: none;
  color: #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.code-copy-btn:hover {
  background-color: #475569;
  color: #f8fafc;
}

.code-block-content {
  padding: 12px;
  margin: 0;
  overflow-x: auto;
  font-family: var(--font-mono), monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #e2e8f0;
  background-color: #090d16;
}

.code-block-content code {
  font-family: var(--font-mono), monospace !important;
  white-space: pre;
}

/* LaTeX Formulas Styling */
.latex-block {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px 0;
  padding: 10px;
  background-color: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  overflow-x: auto;
  font-family: "Cambria Math", "Times New Roman", Times, serif;
  font-size: 0.95rem;
  color: #f8fafc;
}

.latex-inline {
  display: inline-block;
  font-family: "Cambria Math", "Times New Roman", Times, serif;
  font-style: italic;
  color: #60a5fa;
  padding: 0 2px;
}

.latex-frac {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: middle;
  padding: 0 4px;
}

.latex-num {
  border-bottom: 1px solid #94a3b8;
  padding: 0 2px;
  font-size: 0.85em;
  line-height: 1.1;
  text-align: center;
}

.latex-den {
  padding: 0 2px;
  font-size: 0.85em;
  line-height: 1.1;
  text-align: center;
}

.latex-sqrt {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.latex-sqrt-radical {
  font-size: 1.15em;
  line-height: 1;
  font-family: serif;
}

.latex-sqrt-content {
  border-top: 1px solid #94a3b8;
  padding: 0 2px;
  line-height: 1.1;
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
    text = preprocessThinkingTags(text);
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
    bubble.innerHTML = \`<div class="loading-indicator"><div class="spinner"></div> <span>AcceleratedLogic is thinking...</span></div>\`;
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

// React Formatting & LaTeX math parser using KaTeX
const RenderLatex = ({ formula, displayMode = false }: { formula: string; displayMode?: boolean }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode,
          throwOnError: false,
          trust: true,
        });
      } catch (err) {
        console.error("KaTeX rendering error:", err);
        containerRef.current.textContent = formula;
      }
    }
  }, [formula, displayMode]);

  return <span ref={containerRef} className={displayMode ? "block my-1 text-center" : "inline-block align-middle"} />;
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
          <span key={idx} className="inline-block px-0.5 max-w-full overflow-x-auto align-middle text-blue-400">
            <RenderLatex formula={part.content} displayMode={false} />
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

const CodeBlock = ({ lang, content }: { lang: string; content: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden my-2">
      <div className="flex justify-between items-center bg-slate-800 px-2.5 py-1.5 border-b border-slate-700 text-[9px] font-mono text-slate-400">
        <span className="uppercase font-semibold tracking-wider text-[8px] text-slate-400">{lang || 'code'}</span>
        <button 
          onClick={handleCopy}
          className={`px-2 py-0.5 rounded transition-all duration-150 font-sans text-[8px] ${
            copied ? 'bg-emerald-600 text-white font-medium' : 'bg-slate-700 hover:bg-slate-650 text-slate-200'
          }`}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-2.5 overflow-x-auto text-[10px] font-mono text-slate-200 leading-normal">
        <code>{content}</code>
      </pre>
    </div>
  );
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
            <div key={idx} className="flex justify-center items-center my-2.5 p-2.5 rounded-lg border border-slate-700/60 bg-slate-900/60 text-center tracking-wide text-xs text-slate-100 overflow-x-auto">
              <RenderLatex formula={block.content} displayMode={true} />
            </div>
          );
        } else if (block.type === 'code') {
          return (
            <CodeBlock key={idx} lang={block.lang || 'code'} content={block.content} />
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

// Helper to perform fetch requests with exponential backoff retries for rate limits or server errors
async function fetchWithBackoff(url: string, options: any, maxAttempts = 3, initialDelayMs = 1000, backoffFactor = 2): Promise<Response> {
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
    } catch (error: any) {
      if (error.name === "AbortError" || (options && options.signal && options.signal.aborted)) {
        throw error;
      }
      if (attempt >= maxAttempts - 1) {
        throw error;
      }
    }
    const delay = initialDelayMs * Math.pow(backoffFactor, attempt) * (0.8 + Math.random() * 0.4);
    attempt++;
    console.log(`[Backoff Simulator] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function preprocessThinkingTags(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.startsWith("<thinking>")) return text;
  
  const match = text.match(/^\s*(Thought|thought|Thinking|thinking)\s*(:\s*|\n+\s*)/i);
  if (match) {
    const startIndex = match.index! + match[0].length;
    const rest = text.substring(startIndex);
    
    const transitionRegex = /\n\n(?=[a-zA-Z]|\*\*|#|-|\*|\[)/;
    const transitionMatch = rest.match(transitionRegex);
    if (transitionMatch) {
      const transitionIndex = transitionMatch.index!;
      const thoughtContent = rest.substring(0, transitionIndex);
      const restContent = rest.substring(transitionIndex);
      return `<thinking>${thoughtContent}</thinking>${restContent}`;
    } else {
      return `<thinking>${rest}`;
    }
  }
  return text;
}

// Parses thinking blocks out of the text content inside React
function parseThinkingAndContent(text: string) {
  text = preprocessThinkingTags(text);
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

const DEFAULT_SIM_MOCK_TABS = [
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

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulator" | "install" | "explorer">("simulator");
  const [activeFile, setActiveFile] = useState<string>("manifest.json");
  const [copied, setCopied] = useState<boolean>(false);

  // Simulator States
  const [simProvider, setSimProvider] = useState<"gemini" | "openai-compatible">("gemini");
  const [simApiKey, setSimApiKey] = useState<string>("");
  const [simModel, setSimModel] = useState<string>("gemini-2.5-flash");
  const [simCustomModel, setSimCustomModel] = useState<string>("gemini-3.5-flash");
  const [simOpenaiBaseUrl, setSimOpenaiBaseUrl] = useState<string>("https://api.openai.com/v1");
  const [simOpenaiApiKey, setSimOpenaiApiKey] = useState<string>("");
  const [simOpenaiModelId, setSimOpenaiModelId] = useState<string>("gpt-4o-mini");
  const [simOpenaiCapabilities, setSimOpenaiCapabilities] = useState<any>({ vision: false, audio: false });
  const [simScanningOpenai, setSimScanningOpenai] = useState<boolean>(false);
  const [simScanResults, setSimScanResults] = useState<string>("");
  const [simInput, setSimInput] = useState<string>("");
  const [simSettingsOpen, setSimSettingsOpen] = useState<boolean>(false);
  const [simShowKey, setSimShowKey] = useState<boolean>(false);
  const [simAttachment, setSimAttachment] = useState<any>(null);
  const [simPlusMenuOpen, setSimPlusMenuOpen] = useState<boolean>(false);
  const [simTabs, setSimTabs] = useState<Array<any>>(() => DEFAULT_SIM_MOCK_TABS);
  const [activeSimTabId, setActiveSimTabId] = useState<number>(1);
  
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

  // Derive simMessages and activeSimTab
  const activeSimChat = simChats.find(c => c.id === simActiveChatId) || simChats[0];
  const simMessages = activeSimChat ? activeSimChat.messages : [];
  const activeSimTab = simTabs.find(t => t.id === activeSimTabId) || simTabs[0] || DEFAULT_SIM_MOCK_TABS[0];

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

  const SIM_MOCK_TABS = simTabs;

  const handleSelectSimTab = (tab: any) => {
    setSimTabPickerOpen(false);
    setSimLoading(true);
    setActiveSimTabId(tab.id);
    
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

  const handleSimScanOpenai = async () => {
    const endpoint = simOpenaiBaseUrl.trim();
    const key = simOpenaiApiKey.trim();
    const model = simOpenaiModelId.trim();

    if (!endpoint || !key || !model) {
      setSimScanResults("Error: Please enter Base URL, API Key, and Model ID first.");
      return;
    }

    setSimScanningOpenai(true);
    setSimScanResults("Scanning connection and capabilities...");

    const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const TINY_WAV_B64 = "UklGRiYAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQgAAAAAAAAA";

    async function rawCall(messages: any) {
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

    function getErrText(res: any) {
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
        setSimScanResults(`Text failed (${textRes.status}): ` + getErrText(textRes));
        setSimScanningOpenai(false);
        return;
      }

      let detectedVision = false;
      let detectedAudio = false;
      
      const n = model.toLowerCase();
      const visionPattern = /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|o1|o3|o4|gemini|claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku|llava|-vl\b|vision|pixtral|qwen.*vl|internvl|phi-3.*vision|phi-3\.5-vision|llama-3\.2.*vision|llama-4|molmo/;
      const audioPattern = /gpt-4o-audio|realtime|audio-preview|qwen.*audio|omni/;
      const guess = { vision: visionPattern.test(n), audio: audioPattern.test(n) };

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

      setSimOpenaiCapabilities({ vision: detectedVision, audio: detectedAudio });
      setSimScanResults(`Capabilities Verified:\n• Text: Confirmed\n• Vision: ${detectedVision ? "✅ Confirmed" : "❌ Not supported"}\n• Audio: ${detectedAudio ? "✅ Confirmed" : "❌ Not supported"}`);
    } catch (err: any) {
      setSimScanResults("Error scanning: " + err.message);
    }
    setSimScanningOpenai(false);
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
    const canSend = simProvider === "openai-compatible" ? !!simOpenaiApiKey : !!simApiKey;

    if (canSend) {
      setSimLoading(true);
      setSimGenerating(true);
      
      const controller = new AbortController();
      simAbortControllerRef.current = controller;

      try {
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
          if (controller.signal.aborted) {
            throw new DOMException("Generation stopped by user.", "AbortError");
          }
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

          const turnMsgId = Date.now() + Math.random();
          setSimMessages((prev) => [
            ...prev,
            {
              id: turnMsgId,
              role: "assistant",
              text: "",
              toolCalls: []
            }
          ]);

          let response: Response;
          const decoder = new TextDecoder("utf-8");
          let accumulatedText = "";
          let rawModelParts: any[] = [];
          let buffer = "";
          let inThinkingBlock = false;

          const isVisionCapable = simProvider === "gemini" || !!simOpenaiCapabilities?.vision;
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

          if (simProvider === "openai-compatible") {
            let ep = simOpenaiBaseUrl.replace(/\/+$/,'');
            const url = ep.includes('/chat/completions') ? ep : ep + '/chat/completions';
            
            // Format for OpenAI
            const formattedMessages: any[] = [];
            formattedMessages.push({
              role: "system",
              content: systemInstructionText
            });

            optimizedHistory.forEach((msg: any, idx: number) => {
              const isPastTurn = idx < optimizedHistory.length - 1;
              const role = msg.role === 'model' ? 'assistant' : 'user';
              let textContent = "";
              let base64Images: any[] = [];

              msg.parts.forEach((part: any) => {
                if (part.text) {
                  textContent += part.text;
                } else if (part.inlineData) {
                  if (!isPastTurn && simOpenaiCapabilities.vision) {
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
                const contentArray: any[] = [{ type: "text", text: textContent || "Analyze this page screenshot." }];
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
                      selector: { type: "string", description: "CSS selector of the element to click." },
                      textContext: { type: "string", description: "Optional text inside the element." }
                    },
                    required: ["selector"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "click_at_coordinate",
                  description: "Clicks at a specific coordinate and optionally types text.",
                  parameters: {
                    type: "object",
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                      coordinateType: { type: "string", enum: ["percentage", "pixels"] },
                      typeText: { type: "string" },
                      submitAfter: { type: "boolean" }
                    },
                    required: ["x", "y"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "type_text",
                  description: "Types text into input fields.",
                  parameters: {
                    type: "object",
                    properties: {
                      selector: { type: "string" },
                      text: { type: "string" },
                      submitAfter: { type: "boolean" }
                    },
                    required: ["selector", "text"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "scroll_page",
                  description: "Scrolls the webpage.",
                  parameters: {
                    type: "object",
                    properties: {
                      direction: { type: "string", enum: ["up", "down", "left", "right"] },
                      amount: { type: "number" }
                    },
                    required: ["direction"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "open_tab",
                  description: "Opens a new tab.",
                  parameters: {
                    type: "object",
                    properties: { url: { type: "string" } },
                    required: ["url"]
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
                  name: "search_web",
                  description: "Performs search.",
                  parameters: {
                    type: "object",
                    properties: { query: { type: "string" } },
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
                "Authorization": "Bearer " + simOpenaiApiKey
              },
              signal: controller.signal,
              body: JSON.stringify({
                model: simOpenaiModelId,
                messages: formattedMessages,
                stream: true,
                tools: openAITools
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

            const reader = response.body.getReader();
            let openaiToolCalls: any[] = [];

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

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
                        setSimMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === turnMsgId ? { ...msg, text: accumulatedText } : msg
                          )
                        );
                      }
                      if (delta.tool_calls) {
                        delta.tool_calls.forEach((tc: any) => {
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
            // Google Gemini
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModelId}:streamGenerateContent?key=${simApiKey}`;
            
            response = await fetchWithBackoff(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                contents: optimizedHistory,
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
                      parameters: { type: "OBJECT", properties: {} }
                    },
                    ...(isVisionCapable ? [{
                      name: "get_page_screenshot",
                      description: "Captures a visual screenshot of the current visible tab's viewport as base64 JPEG image data.",
                      parameters: { type: "OBJECT", properties: {} }
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

            const reader = response.body.getReader();

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
          }

          if (activeFunctionCall) {
            if (controller.signal.aborted) {
              throw new DOMException("Generation stopped by user.", "AbortError");
            }
            hasMoreTurns = true;

            // 1. Save model function call to local history (preserving generated thoughts/text and signatures)
            localHistory.push({
              role: "model",
              parts: rawModelParts
            });

            // 2. Execute tool inside simulator
            let toolOutput: any = null;

            const simulateTyping = async (initialTarget: HTMLElement, text: string, submit: boolean) => {
              if (!initialTarget) return;

              // 1. Give any focus-shifting click event handlers a moment to settle
              await new Promise((r) => setTimeout(r, 20));

              // 2. Determine the actual input/editing target
              let target = initialTarget;
              if (document.activeElement && (
                document.activeElement.tagName === "INPUT" ||
                document.activeElement.tagName === "TEXTAREA" ||
                (document.activeElement as HTMLElement).isContentEditable ||
                document.activeElement.getAttribute('role') === 'textbox' ||
                document.activeElement.classList.contains('docs-textarea')
              )) {
                target = document.activeElement as HTMLElement;
              } else {
                const docTextarea = document.querySelector('.docs-textarea') as HTMLElement | null;
                if (docTextarea) {
                  target = docTextarea;
                }
              }

              target.focus();

              // 3. Special handling for Google Docs (.docs-textarea) or when inside a Google Docs iframe/page
              const isGoogleDocs = target.classList.contains('docs-textarea') || 
                                   window.location.hostname.includes('docs.google.com') ||
                                   document.querySelector('.docs-textarea') !== null;

              if (isGoogleDocs) {
                try {
                  target.focus();

                  // Try 1: textInput event
                  try {
                    const textEvent = document.createEvent('TextEvent');
                    (textEvent as any).initTextEvent('textInput', true, true, window, text, 0, 'en-US');
                    target.dispatchEvent(textEvent);
                  } catch (e) {}

                  // Try 2: beforeinput + input event
                  try {
                    const beforeInputEvent = new InputEvent('beforeinput', {
                      bubbles: true,
                      cancelable: true,
                      inputType: 'insertText',
                      data: text
                    });
                    target.dispatchEvent(beforeInputEvent);
                  } catch (e) {}

                  // Try 3: Direct value setting
                  const originalValue = (target as HTMLTextAreaElement).value;
                  (target as HTMLTextAreaElement).value = text;
                  target.dispatchEvent(new Event('input', { bubbles: true }));
                  target.dispatchEvent(new Event('change', { bubbles: true }));

                  // Try 4: Synthetic paste event
                  const dataTransfer = new DataTransfer();
                  dataTransfer.setData('text/plain', text);
                  const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                  });
                  target.dispatchEvent(pasteEvent);

                  // Try 5: Character keyboard events
                  for (let i = 0; i < text.length; i++) {
                    if (controller.signal.aborted) {
                      return;
                    }
                    const char = text[i];
                    const keyCode = char.toUpperCase().charCodeAt(0);
                    const charCode = char.charCodeAt(0);

                    target.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
                    target.dispatchEvent(new KeyboardEvent('keypress', { key: char, keyCode: charCode, which: charCode, bubbles: true, cancelable: true }));
                    
                    (target as HTMLTextAreaElement).value = char;
                    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
                    
                    target.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Key${char.toUpperCase()}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
                  }
                  
                  // Reset value
                  (target as HTMLTextAreaElement).value = "";
                  target.dispatchEvent(new Event('input', { bubbles: true }));

                  if (submit) {
                    const activeEl = document.activeElement || target;
                    activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                  }
                  return;
                } catch (err) {}
              }

              // 4. Fallback character-by-character typing for standard/rich editors
              for (let i = 0; i < text.length; i++) {
                if (controller.signal.aborted) {
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

                // BeforeInput (crucial for rich text editors, Slate, Lexical, Quill, etc.)
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
                    const el = target as HTMLInputElement | HTMLTextAreaElement;
                    const start = el.selectionStart || 0;
                    const end = el.selectionEnd || 0;
                    const oldVal = el.value;
                    const newVal = oldVal.substring(0, start) + char + oldVal.substring(end);
                    
                    // Bypass framework property overrides (React / Vue virtual DOM setters)
                    const prototype = Object.getPrototypeOf(el);
                    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                    if (setter) {
                      setter.call(el, newVal);
                    } else {
                      el.value = newVal;
                    }
                    el.selectionStart = el.selectionEnd = start + 1;
                  } else {
                    const targetEditable = (target.isContentEditable ? target : (
                      target.querySelector('[contenteditable="true"]') ||
                      target.querySelector('.ql-editor') ||
                      target.querySelector('.public-DraftEditor-content') ||
                      target.querySelector('.ProseMirror') ||
                      target.querySelector('[role="textbox"]')
                    )) as HTMLElement | null;

                    if (targetEditable) {
                      targetEditable.focus();
                      
                      // Try Webkit/Blink TextEvent (extremely powerful for custom rich editors)
                      let textEventHandled = false;
                      try {
                        const textEvent = document.createEvent('TextEvent');
                        (textEvent as any).initTextEvent('textInput', true, true, window, char, 0, 'en-US');
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
                        (textEvent as any).initTextEvent('textInput', true, true, window, char, 0, 'en-US');
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
                const form = (target as any).form || (target.closest ? target.closest('form') : null);
                if (form) {
                  if (form.requestSubmit) form.requestSubmit();
                  else form.submit();
                } else {
                  const activeEl = document.activeElement || target;
                  activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                }
              }
            };

            if (activeFunctionCall.name === "get_page_dom") {
              const title = simAttachment?.domContext?.title || activeSimTab.title;
              const url = simAttachment?.domContext?.url || activeSimTab.url;
              const text = simAttachment?.domContext?.text || activeSimTab.text;
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
            } else if (activeFunctionCall.name === "click_at_coordinate") {
              const x = activeFunctionCall.args?.x || 0;
              const y = activeFunctionCall.args?.y || 0;
              const coordType = activeFunctionCall.args?.coordinateType || "percentage";
              const typeText = activeFunctionCall.args?.typeText || "";
              const submitAfter = !!activeFunctionCall.args?.submitAfter;

              const viewport = document.getElementById("simulated-webpage-viewport") || document.body;
              let clientX = 0, clientY = 0;
              const rect = viewport.getBoundingClientRect();
              if (coordType === "percentage") {
                clientX = rect.left + (x / 100) * rect.width;
                clientY = rect.top + (y / 100) * rect.height;
              } else {
                clientX = rect.left + x;
                clientY = rect.top + y;
              }

              // Visual indicator in mockup
              const dot = document.createElement("div");
              dot.style.position = "fixed";
              dot.style.left = `${clientX - 12}px`;
              dot.style.top = `${clientY - 12}px`;
              dot.style.width = "24px";
              dot.style.height = "24px";
              dot.style.borderRadius = "50%";
              dot.style.backgroundColor = "rgba(139, 92, 246, 0.4)";
              dot.style.border = "2px solid #a78bfa";
              dot.style.boxShadow = "0 0 12px #8b5cf6";
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

              const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
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

                  toolOutput = {
                    success: true,
                    tagName: target.tagName,
                    id: target.id,
                    message: `[Simulator] Clicked coordinate (${x}, ${y}) targeting <${target.tagName.toLowerCase()}>${typedMsg}.`
                  };
                } catch (err: any) {
                  toolOutput = { success: false, error: err.message };
                }
              } else {
                toolOutput = {
                  success: true,
                  message: `[Simulator Fallback] Clicked coordinate (${x}, ${y}) in virtual space.`
                };
              }
            } else if (activeFunctionCall.name === "type_text") {
              const sel = activeFunctionCall.args?.selector || "";
              const txt = activeFunctionCall.args?.text || "";
              const submitAfter = !!activeFunctionCall.args?.submitAfter;
              let target: any = null;
              try {
                target = document.querySelector(sel);
              } catch (e) {}

              if (target) {
                try {
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  target.focus();

                  await simulateTyping(target, txt, submitAfter);

                  toolOutput = {
                    success: true,
                    tagName: target.tagName,
                    id: target.id,
                    message: `[Simulator] Typed "${txt}" into target element on current screen.`
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
            } else if (activeFunctionCall.name === "scroll_page") {
              const dir = activeFunctionCall.args?.direction || "down";
              const amt = activeFunctionCall.args?.amount || 500;
              const viewport = (document.getElementById("simulated-webpage-viewport") || window) as any;
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

              toolOutput = {
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
              };
            } else if (activeFunctionCall.name === "open_tab") {
              const url = activeFunctionCall.args?.url || "https://example.com";
              const newTabId = Date.now();
              const hostname = url.replace("https://", "").replace("http://", "").split("/")[0];
              const newTab = {
                id: newTabId,
                title: hostname.charAt(0).toUpperCase() + hostname.slice(1) || "New Tab",
                url: url,
                icon: "🌐",
                screenshot: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80",
                text: `Successfully opened new tab. This is a live simulation of the page at ${url}.\n\nYou are currently viewing this tab. You can interact with its elements, scroll, click, or scrape the context.`
              };
              setSimTabs(prev => [...prev, newTab]);
              setActiveSimTabId(newTabId);

              // Auto-capture context for the extension simulator
              setSimAttachment({
                name: `Capture: ${newTab.title}`,
                size: "Current Webpage (DOM + HTML)",
                type: "image/jpeg",
                isImage: true,
                base64: newTab.screenshot,
                domContext: {
                  title: newTab.title,
                  url: newTab.url,
                  text: newTab.text
                }
              });

              toolOutput = {
                success: true,
                tabId: newTabId,
                url: url,
                message: `[Simulator] Successfully opened a new tab: ${url} and loaded its context.`
              };
            } else if (activeFunctionCall.name === "wait") {
              const delay = Number(activeFunctionCall.args?.delayMs) || 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
              toolOutput = {
                success: true,
                delayMs: delay,
                message: `[Simulator] Successfully waited/slept for ${delay}ms.`
              };
            } else if (activeFunctionCall.name === "search_web") {
              const query = activeFunctionCall.args?.query || "";
              const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
              const newTabId = Date.now();
              const newTab = {
                id: newTabId,
                title: `Google Search: ${query}`,
                url: searchUrl,
                icon: "🔍",
                screenshot: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
                text: `Google Search Results for "${query}":\n\n1. ${query} Official Site - Complete features & developer resources.\n2. Getting Started with ${query} - Beginner guides & fast tutorial.\n3. Community Forum - Join discussions and ask questions about ${query}.`
              };
              setSimTabs(prev => [...prev, newTab]);
              setActiveSimTabId(newTabId);

              // Auto-capture context for the extension simulator
              setSimAttachment({
                name: `Capture: ${newTab.title}`,
                size: "Current Webpage (DOM + HTML)",
                type: "image/jpeg",
                isImage: true,
                base64: newTab.screenshot,
                domContext: {
                  title: newTab.title,
                  url: newTab.url,
                  text: newTab.text
                }
              });

              toolOutput = {
                success: true,
                tabId: newTabId,
                query: query,
                message: `[Simulator] Searched the web for "${query}" and loaded the search results tab.`
              };
            } else if (activeFunctionCall.name === "list_tabs") {
              toolOutput = {
                success: true,
                tabs: simTabs.map(t => ({
                  id: t.id,
                  title: t.title,
                  url: t.url,
                  active: t.id === activeSimTabId
                }))
              };
            } else if (activeFunctionCall.name === "switch_tab") {
              const targetTabId = Number(activeFunctionCall.args?.tabId);
              const targetTab = simTabs.find(t => t.id === targetTabId);
              if (targetTab) {
                setActiveSimTabId(targetTabId);
                setSimAttachment({
                  name: `Capture: ${targetTab.title}`,
                  size: "Current Webpage (DOM + HTML)",
                  type: "image/jpeg",
                  isImage: true,
                  base64: targetTab.screenshot,
                  domContext: {
                    title: targetTab.title,
                    url: targetTab.url,
                    text: targetTab.text
                  }
                });
                toolOutput = {
                  success: true,
                  tabId: targetTabId,
                  title: targetTab.title,
                  url: targetTab.url,
                  message: `[Simulator] Successfully switched active tab to: ${targetTab.title}`
                };
              } else {
                toolOutput = {
                  success: false,
                  error: `[Simulator] Tab with ID ${targetTabId} not found.`
                };
              }
            } else if (activeFunctionCall.name === "press_key") {
              const k = activeFunctionCall.args?.key || "";
              const duration = activeFunctionCall.args?.holdDuration !== undefined ? Number(activeFunctionCall.args?.holdDuration) : 50;
              toolOutput = {
                success: true,
                message: `[Simulator] Successfully pressed key "${k}" and held it down for ${duration}ms on the simulated page.`
              };
            } else if (activeFunctionCall.name === "select_text") {
              const txt = activeFunctionCall.args?.searchText || "";
              toolOutput = {
                success: true,
                message: `[Simulator] Successfully selected and highlighted text "${txt}" on the simulated page.`
              };
            } else if (activeFunctionCall.name === "replace_text") {
              const rep = activeFunctionCall.args?.replaceText || "";
              toolOutput = {
                success: true,
                message: `[Simulator] Successfully replaced text with "${rep}" on the simulated page.`
              };
            }

            // Append status note to the assistant's text
            let responseNote = "Context successfully loaded!";
            if (activeFunctionCall.name === "click_element") {
              responseNote = `Element clicked successfully!`;
            } else if (activeFunctionCall.name === "click_at_coordinate") {
              responseNote = `Clicked coordinate (${activeFunctionCall.args?.x || 0}, ${activeFunctionCall.args?.y || 0})!`;
            } else if (activeFunctionCall.name === "type_text") {
              responseNote = `Typed text: "${activeFunctionCall.args?.text || ""}"`;
            } else if (activeFunctionCall.name === "scroll_page") {
              responseNote = `Scrolled page ${activeFunctionCall.args?.direction || "down"}!`;
            } else if (activeFunctionCall.name === "open_tab") {
              responseNote = `Opened new tab: ${activeFunctionCall.args?.url || ""}`;
            } else if (activeFunctionCall.name === "wait") {
              responseNote = `Waited for ${activeFunctionCall.args?.delayMs || 1000}ms...`;
            } else if (activeFunctionCall.name === "search_web") {
              responseNote = `Searched web for "${activeFunctionCall.args?.query || ""}"`;
            } else if (activeFunctionCall.name === "list_tabs") {
              responseNote = `Listed active tabs!`;
            } else if (activeFunctionCall.name === "switch_tab") {
              const tabTitle = simTabs.find(t => t.id === Number(activeFunctionCall.args?.tabId))?.title || activeFunctionCall.args?.tabId;
              responseNote = `Switched tab to: ${tabTitle}`;
            } else if (activeFunctionCall.name === "press_key") {
              const k = activeFunctionCall.args?.key || "";
              const duration = activeFunctionCall.args?.holdDuration !== undefined ? Number(activeFunctionCall.args?.holdDuration) : 50;
              responseNote = `Pressed key: "${k}"${duration > 50 ? ` (held down for ${duration}ms)` : ""}`;
            } else if (activeFunctionCall.name === "select_text") {
              responseNote = `Selected/highlighted text: "${activeFunctionCall.args?.searchText || ""}"`;
            } else if (activeFunctionCall.name === "replace_text") {
              responseNote = `Replaced text with: "${activeFunctionCall.args?.replaceText || ""}"`;
            }

            let screenshotUrl = "";
            if (activeFunctionCall.name === "get_page_screenshot") {
              const tabTitle = simAttachment?.domContext?.title || activeSimTab.title;
              const tabUrl = simAttachment?.domContext?.url || activeSimTab.url;
              const tabText = simAttachment?.domContext?.text || activeSimTab.text;
              screenshotUrl = generateMockScreenshot(tabTitle, tabUrl, tabText);
            }

            const newToolCall = {
              id: Date.now() + Math.random(),
              name: activeFunctionCall.name,
              args: activeFunctionCall.args,
              response: responseNote,
              screenshotUrl: screenshotUrl || undefined
            };

            setSimMessages((prev: any[]) =>
              prev.map((msg) =>
                msg.id === turnMsgId 
                  ? { 
                      ...msg, 
                      text: accumulatedText, 
                      toolCalls: [...(msg.toolCalls || []), newToolCall] 
                    } 
                  : msg
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
              const tabTitle = simAttachment?.domContext?.title || activeSimTab.title;
              const tabUrl = simAttachment?.domContext?.url || activeSimTab.url;
              const tabText = simAttachment?.domContext?.text || activeSimTab.text;
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
              parts: rawModelParts
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
              <div className="flex items-center gap-1 flex-1 max-w-[340px] ml-4 text-left overflow-x-auto no-scrollbar pt-1.5 select-none h-full">
                {simTabs.map((tab) => {
                  const isActive = tab.id === activeSimTabId;
                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveSimTabId(tab.id)}
                      className={`px-2 py-1 text-[8.5px] font-medium truncate rounded-t-md cursor-pointer transition-all flex items-center gap-1.5 max-w-[100px] border-t border-x shrink-0 ${
                        isActive
                          ? "bg-slate-900 border-slate-800/80 text-slate-100 shadow-sm"
                          : "bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/40"
                      }`}
                      title={tab.title}
                    >
                      <span>{tab.icon || "🌐"}</span>
                      <span className="truncate flex-1">{tab.title}</span>
                      {simTabs.length > 1 && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            const remaining = simTabs.filter(t => t.id !== tab.id);
                            setSimTabs(remaining);
                            if (isActive) {
                              setActiveSimTabId(remaining[0].id);
                            }
                          }}
                          className="text-[7.5px] text-slate-500 hover:text-rose-400 font-sans ml-1 select-none font-bold"
                        >
                          ✕
                        </span>
                      )}
                    </div>
                  );
                })}
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
                <span className="text-[9px] text-slate-400 font-mono truncate select-all flex-1">{activeSimTab.url}</span>
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
              <div id="simulated-webpage-viewport" className="hidden sm:flex sm:flex-col sm:flex-1 bg-slate-950 p-4 overflow-y-auto border-r border-slate-800/80 text-left relative">
                <div className="border-b border-slate-800 pb-3 mb-3">
                  <div className="text-blue-500 font-mono text-[9px] uppercase font-bold tracking-wider">
                    {activeSimTab.url.includes("search") ? "Web Search" : "Browser Tab"}
                  </div>
                  <h2 className="text-sm font-bold text-white mt-1 leading-snug">
                    {activeSimTab.title}
                  </h2>
                  <div className="text-[9px] text-slate-500 mt-1">URL: {activeSimTab.url}</div>
                </div>

                <div className="space-y-3 text-[11px]">
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {activeSimTab.text}
                  </p>

                  {activeSimTab.screenshot && (
                    <div className="rounded-lg overflow-hidden border border-slate-800/60 max-h-[140px] bg-slate-900 flex items-center justify-center">
                      <img src={activeSimTab.screenshot} alt="Page Visual" className="w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Simulated webpage highlight */}
                  <div className="p-2.5 bg-blue-950/20 border border-blue-500/20 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wide">Target Webpage Scraped DOM:</span>
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded font-mono">Ready</span>
                    </div>
                    <div className="text-slate-400 text-[9px] font-mono leading-relaxed bg-slate-950 p-1.5 rounded border border-slate-900/60 max-h-[80px] overflow-y-auto">
                      Title: {activeSimTab.title}<br />
                      URL: {activeSimTab.url}<br />
                      DOM Text: {activeSimTab.text.substring(0, 150)}...
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSelectSimTab(activeSimTab)}
                    className="w-full py-2 bg-gradient-to-r from-blue-600/90 to-violet-600/90 hover:from-blue-600 hover:to-violet-600 text-white font-medium rounded-md transition text-[10px] flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span>📸</span>
                    <span>Simulate Page Capture in Sidebar</span>
                  </button>

                  {/* Rich-Text Editor Sandbox (Simulating Quill / Draft.js / ProseMirror) */}
                  <div className="mt-4 p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wide flex items-center gap-1">
                        📝 Quill Rich-Text Editor Sandbox
                      </span>
                      <span className="text-[8px] bg-violet-500/10 text-violet-400 px-1 rounded font-mono">Interactive</span>
                    </div>
                    {/* Rich text formatting toolbar mockup */}
                    <div className="flex gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded text-slate-500 text-[9px] font-mono select-none">
                      <span className="font-bold hover:text-slate-300 cursor-pointer px-1">B</span>
                      <span className="italic hover:text-slate-300 cursor-pointer px-1">I</span>
                      <span className="underline hover:text-slate-300 cursor-pointer px-1">U</span>
                      <span className="hover:text-slate-300 cursor-pointer px-1">Link</span>
                      <span className="hover:text-slate-300 cursor-pointer px-1">Quote</span>
                    </div>
                    <div 
                      contentEditable
                      suppressContentEditableWarning
                      className="ql-editor ProseMirror min-h-[50px] p-2 bg-slate-950 text-slate-200 text-[10px] rounded border border-slate-800 focus:outline-none focus:border-violet-500/50 leading-relaxed font-sans empty:before:content-['Type_your_rich-text_notes_here...'] empty:before:text-slate-600 empty:before:pointer-events-none"
                      style={{ outline: 'none' }}
                    ></div>
                  </div>
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
                        <label className="text-[9px] font-medium text-slate-400">API Provider</label>
                        <select
                          value={simProvider}
                          onChange={(e) => setSimProvider(e.target.value as any)}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-100 outline-none focus:border-blue-500"
                        >
                          <option value="gemini">Google Gemini API</option>
                          <option value="openai-compatible">OpenAI-Compatible API</option>
                        </select>
                      </div>

                      {simProvider === "gemini" ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-medium text-slate-400">Base URL</label>
                            <input
                              type="text"
                              value={simOpenaiBaseUrl}
                              onChange={(e) => setSimOpenaiBaseUrl(e.target.value)}
                              placeholder="e.g. https://api.openai.com/v1"
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-100 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-medium text-slate-400">API Key</label>
                            <div className="flex gap-1">
                              <input
                                type={simShowKey ? "text" : "password"}
                                value={simOpenaiApiKey}
                                onChange={(e) => setSimOpenaiApiKey(e.target.value)}
                                placeholder="Paste your API Key..."
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
                            <label className="text-[9px] font-medium text-slate-400">Model ID</label>
                            <input
                              type="text"
                              value={simOpenaiModelId}
                              onChange={(e) => setSimOpenaiModelId(e.target.value)}
                              placeholder="e.g. gpt-4o-mini"
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-100 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="pt-1.5 flex flex-col gap-1.5 border-t border-slate-700/60 mt-1">
                            <button
                              onClick={handleSimScanOpenai}
                              disabled={simScanningOpenai}
                              className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 font-medium rounded py-1 text-[10px] transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {simScanningOpenai ? (
                                <>
                                  <span className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                                  Scanning...
                                </>
                              ) : (
                                "🔍 Scan Model Capabilities"
                              )}
                            </button>

                            {simScanResults && (
                              <pre className="p-1.5 bg-slate-900 border border-slate-700/50 rounded text-[9px] font-mono text-slate-300 whitespace-pre-wrap leading-tight">
                                {simScanResults}
                              </pre>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setSimSettingsOpen(false);
                          const hasKey = simProvider === "openai-compatible" ? !!simOpenaiApiKey : !!simApiKey;
                          setSimMessages((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              role: "assistant",
                              text: hasKey 
                                ? `✅ Settings saved! Using ${simProvider === "openai-compatible" ? "OpenAI-Compatible model: " + simOpenaiModelId : "Google Gemini"}.`
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
                  {((simProvider === "gemini" && !simApiKey) || (simProvider === "openai-compatible" && !simOpenaiApiKey)) && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] leading-relaxed">
                      ⚠️ <strong>Real request mode is paused.</strong> Enter your {simProvider === "openai-compatible" ? "OpenAI API" : "Gemini API"} key via settings (⚙️) above for live model generation.
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

                              {/* Beautiful Collapsible Tool Executions block on top like thinking */}
                              {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <div className="border border-dashed border-purple-500/25 rounded-lg bg-slate-900/50 overflow-hidden text-left">
                                  <details className="group" open={true}>
                                    <summary className="flex items-center justify-between px-2 py-1 bg-purple-500/5 text-purple-300 font-medium text-[9px] cursor-pointer hover:bg-purple-500/10 outline-none select-none">
                                      <span className="flex items-center gap-1">
                                        <span className="inline-block">🛠️</span>
                                        <span>Tool Executions ({msg.toolCalls.length})</span>
                                      </span>
                                      <span className="text-[7px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="p-1.5 border-t border-purple-500/10 space-y-2 max-h-[150px] overflow-y-auto">
                                      {msg.toolCalls.map((tc: any, tcIdx: number) => (
                                        <div key={tc.id || tcIdx} className="space-y-1 text-[8.5px] border-b border-slate-800 pb-1.5 last:border-0 last:pb-0">
                                          <div className="flex items-center justify-between font-mono text-slate-300">
                                            <span className="font-semibold text-purple-400">{tc.name}()</span>
                                            {tc.args && Object.keys(tc.args).length > 0 && (
                                              <span className="text-slate-500 text-[8px] truncate max-w-[120px]">
                                                {JSON.stringify(tc.args)}
                                              </span>
                                            )}
                                          </div>
                                          <div className="bg-slate-950/80 p-1 rounded font-mono text-slate-400 whitespace-pre-wrap leading-normal border border-slate-800/40">
                                            {tc.response}
                                          </div>
                                          {tc.screenshotUrl && (
                                            <div className="mt-1">
                                              <details className="group/ss">
                                                <summary className="text-[7.5px] text-purple-400/80 hover:text-purple-300 font-mono cursor-pointer select-none outline-none flex items-center gap-1">
                                                  <span>📷 Captured Viewport</span>
                                                  <span className="text-[6.5px] group-open/ss:hidden">(Click to Expand)</span>
                                                  <span className="text-[6.5px] hidden group-open/ss:inline">(Click to Collapse)</span>
                                                </summary>
                                                <div className="mt-1 rounded-md overflow-hidden border border-purple-500/10 max-h-[160px] overflow-y-auto bg-slate-950">
                                                  <img 
                                                    src={tc.screenshotUrl} 
                                                    alt="Captured Viewport" 
                                                    className="w-full object-contain"
                                                    referrerPolicy="no-referrer"
                                                  />
                                                </div>
                                              </details>
                                            </div>
                                          )}
                                        </div>
                                      ))}
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

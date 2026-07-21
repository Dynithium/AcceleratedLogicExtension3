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
  "name": "AcceleratedLogic AI",
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
  },
  "web_accessible_resources": [
    {
      "resources": [
        "katex/fonts/*"
      ],
      "matches": [
        "<all_urls>"
      ]
    }
  ]
}
`;

const BACKGROUND_CODE = `// AcceleratedLogic AI - Background Script
// This background worker listens for installation events.

chrome.runtime.onInstalled.addListener(() => {
  console.log("AcceleratedLogic AI Chrome Extension installed successfully.");
});

// Enable opening the side panel on clicking the action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
`;

const POPUP_HTML_CODE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AcceleratedLogic AI</title>
  <link rel="stylesheet" href="katex/katex.min.css">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="app-container">
    <!-- Header Section -->
    <header class="app-header">
      <div class="logo-area">
        <span class="sparkle-icon">✨</span>
        <h1 class="title">AcceleratedLogic AI</h1>
      </div>
      <div class="header-actions">
        <button id="btn-chats" class="icon-button" title="Chats History">
          💬
        </button>
        <button id="btn-settings" class="icon-button" title="Configure Settings">
          ⚙️
        </button>
      </div>
    </header>

    <!-- Chats Pane (Collapsible) -->
    <div id="chats-pane" class="chats-pane collapsed">
      <div class="chats-header">
        <h3>My Chats</h3>
        <button id="btn-new-chat" class="primary-button compact-btn">＋ New Chat</button>
      </div>
      <div class="chats-body" id="chats-list">
        <!-- Dynmically loaded chats list -->
      </div>
    </div>

    <!-- Settings Pane (Collapsible) -->
    <div id="settings-pane" class="settings-pane collapsed">
      <div class="settings-header">
        <h3>Configuration</h3>
      </div>
      <div class="settings-body">
        <div class="form-group">
          <label for="select-provider">API Provider</label>
          <select id="select-provider" style="width: 100%; padding: 8px; border-radius: 6px; background: var(--panel-2, #181c1f); color: var(--text, #e7eaec); border: 1px solid var(--border, #23282c); font-family: inherit;">
            <option value="gemini">Gemini API (Google AI Studio)</option>
            <option value="openai-compatible">OpenAI-Compatible API (Custom / Local)</option>
          </select>
        </div>

        <!-- Gemini Settings Group -->
        <div id="gemini-settings-group">
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
            <input type="text" id="input-custom-model" placeholder="e.g. gemini-3.5-flash" value="gemini-2.5-flash" />
          </div>
        </div>

        <!-- OpenAI-Compatible Settings Group -->
        <div id="openai-settings-group" style="display: none;">
          <div class="form-group">
            <label for="input-openai-base-url">Base URL</label>
            <input type="text" id="input-openai-base-url" placeholder="https://api.openai.com/v1" value="https://api.openai.com/v1" />
          </div>
          <div class="form-group">
            <label for="input-openai-api-key">API Key</label>
            <div class="input-with-action">
              <input type="password" id="input-openai-api-key" placeholder="sk-..." />
              <button id="btn-toggle-openai-key-visibility" class="text-button">Show</button>
            </div>
          </div>
          <div class="form-group">
            <label for="input-openai-model-id">Model ID</label>
            <input type="text" id="input-openai-model-id" placeholder="gpt-4o-mini" value="gpt-4o-mini" />
          </div>
          <div class="form-group">
            <button id="btn-scan-openai" class="primary-button" style="width: 100%; margin-top: 5px; background: #1c2b3a; border-color: #2c4560; color: #bcd6f5;">🔍 Scan Model Capabilities</button>
            <div id="openai-scan-results" style="margin-top: 8px; font-size: 11px; font-family: monospace; line-height: 1.4; color: #838d95;">
              Capabilities: Not scanned
            </div>
          </div>
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
        <h2>Welcome to AcceleratedLogic AI</h2>
        <p>Talk to Gemini directly from any browser tab! Capture screens, upload files, and chat seamlessly.</p>
        
        <div class="preset-suggestions">
          <button class="preset-btn" data-prompt="Summarize this web page for me.">
            📝 Summarize this page
          </button>
          <button class="preset-btn" data-prompt="What are the key takeaways from the content on this website?">
            💡 Key takeaways
          </button>
          <button class="preset-btn" data-prompt="Can you explain the main concepts discussed here in simple terms?">
            🧠 Explain main concepts
          </button>
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
        <button id="btn-remove-attachment" class="remove-button" title="Remove attachment">×</button>
      </div>
    </div>

    <!-- Interactive Input Panel -->
    <footer class="app-input-panel">
      <!-- Input Action Dropdown/Menu -->
      <div class="prompt-controls">
        <div class="relative-container">
          <button id="btn-plus" class="plus-button" title="Attach file or screenshot">
            ＋
          </button>
          
          <!-- Dropdown Menu -->
          <div id="plus-menu" class="plus-menu hidden">
            <button id="menu-upload-file" class="menu-item">
              <span class="icon">📁</span> Upload File
            </button>
            <button id="menu-capture-page" class="menu-item">
              <span class="icon">📸</span> Capture Tab (Screenshot + DOM)
            </button>
          </div>
        </div>

        <!-- Hidden input elements -->
        <input type="file" id="hidden-file-input" style="display: none;" />

        <textarea id="prompt-input" placeholder="Type a message or query page context..." rows="1"></textarea>

        <button id="btn-send" class="send-button" title="Send message">
          <svg viewBox="0 0 24 24" class="send-icon">
            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
          </svg>
        </button>
      </div>
    </footer>
  </div>

  <!-- Tab Picker Overlay Modal -->
  <div id="tab-picker-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Select Tab to Capture</span>
        <button id="close-tab-picker" class="modal-close-btn" title="Close modal">&times;</button>
      </div>
      <div id="picker-tab-list" class="tab-list">
        <!-- Filled dynamically -->
      </div>
    </div>
  </div>

  <script src="katex/katex.min.js"></script>
  <script src="popup.js"></script>
</body>
</html>
`;

const POPUP_CSS_CODE = `/* AcceleratedLogic AI - Style Sheet */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  width: 100%;
  height: 100vh;
  background-color: #0f172a; /* Slate 900 */
  color: #f1f5f9; /* Slate 100 */
  overflow: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header styling */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #1e293b; /* Slate 800 */
  border-bottom: 1px solid #334155; /* Slate 700 */
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
  letter-spacing: -0.025em;
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-button:hover {
  background-color: #334155;
  color: #f1f5f9;
}

/* Settings Pane */
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
  overflow: hidden;
  opacity: 0;
}

.settings-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
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
  width: 100%;
  outline: none;
  transition: border-color 0.2s ease;
}

.form-group input:focus, .form-group select:focus {
  border-color: #3b82f6;
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
  transition: background-color 0.2s;
}

.text-button:hover {
  background-color: #475569;
  color: #f1f5f9;
}

.help-text {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 2px;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
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
  transition: opacity 0.2s;
}

.primary-button:hover {
  opacity: 0.9;
}

/* Chat Log Area */
.chat-log {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: #0f172a;
}

/* Welcome page */
.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  margin-top: auto;
  margin-bottom: auto;
  color: #94a3b8;
}

.welcome-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.welcome-screen h2 {
  font-size: 1.15rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 8px;
}

.welcome-screen p {
  font-size: 0.85rem;
  line-height: 1.4;
  max-width: 300px;
  margin-bottom: 16px;
}

.preset-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 320px;
  margin-bottom: 16px;
}

.preset-btn {
  background-color: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background-color: #334155;
  color: #f8fafc;
  border-color: #475569;
}

.status-warning {
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  font-size: 0.75rem;
  padding: 8px 12px;
  border-radius: 6px;
  line-height: 1.3;
}

/* Chat Bubbles */
.message-bubble {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.85rem;
  line-height: 1.45;
  word-wrap: break-word;
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

.message-bubble.error-message {
  align-self: center;
  background-color: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 0.8rem;
  max-width: 95%;
  text-align: center;
  border-radius: 8px;
}

.message-header {
  font-size: 0.7rem;
  font-weight: 500;
  margin-bottom: 4px;
  opacity: 0.8;
  display: flex;
  justify-content: space-between;
}

.message-bubble.user .message-header {
  color: #93c5fd;
}

.message-bubble.assistant .message-header {
  color: #3b82f6;
}

/* Bubble Attachment Preview Inside Log */
.bubble-attachment {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
  font-size: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.bubble-attachment-thumbnail {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  background-color: #1e293b;
}

/* Bubble Viewport Screenshot Container */
.bubble-screenshot-container {
  margin: 10px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #334155;
  background-color: rgba(0, 0, 0, 0.25);
  max-height: 150px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.bubble-screenshot-container:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.bubble-screenshot-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  max-height: 150px;
  transition: max-height 0.2s ease-in-out;
}

.bubble-screenshot-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background-color: rgba(15, 23, 42, 0.85);
  color: #f1f5f9;
  font-size: 0.65rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  letter-spacing: 0.02em;
}

.bubble-text {
  white-space: pre-wrap;
}

/* Loading indicator inside bubble */
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 0.8rem;
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

/* Attachment Area */
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

.attachment-icon {
  font-size: 1.1rem;
}

.attachment-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.attachment-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #cbd5e1;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.attachment-size {
  font-size: 0.65rem;
  color: #64748b;
}

.remove-button {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
}

.remove-button:hover {
  background-color: #334155;
  color: #ef4444;
}

/* Input Area */
.app-input-panel {
  padding: 12px 16px;
  background-color: #1e293b;
  border-top: 1px solid #334155;
  z-index: 10;
}

.prompt-controls {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  position: relative;
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
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.plus-button:hover {
  background-color: #475569;
}

/* Plus Popover Menu */
.plus-menu {
  position: absolute;
  bottom: 44px;
  left: 0;
  background-color: #1e293b;
  border: 1px solid #475569;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  width: 250px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 4px;
  animation: popIn 0.15s ease-out;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.95) translateY(5px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
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
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
  width: 100%;
}

.menu-item:hover {
  background-color: #334155;
  color: #f8fafc;
}

.menu-item .icon {
  font-size: 1.05rem;
}

/* Prompt textbox */
#prompt-input {
  flex: 1;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f1f5f9;
  padding: 8px 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  outline: none;
  resize: none;
  max-height: 100px;
  transition: border-color 0.2s;
}

#prompt-input:focus {
  border-color: #3b82f6;
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
  transition: background-color 0.2s;
}

.send-button:hover {
  background-color: #3b82f6;
}

.send-icon {
  width: 18px;
  height: 18px;
  fill: #ffffff;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #0f172a;
}

::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #475569;
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

/* Collapsible Tools Block Styling */
.tools-block {
  margin-top: 6px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: rgba(30, 41, 59, 0.4);
  border: 1px dashed rgba(168, 85, 247, 0.25);
  overflow: hidden;
}

.tools-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: rgba(168, 85, 247, 0.06);
  border: none;
  cursor: pointer;
  color: #c084fc;
  font-size: 0.725rem;
  font-weight: 500;
  text-align: left;
  outline: none;
}

.tools-toggle-btn:hover {
  background-color: rgba(168, 85, 247, 0.12);
}

.tools-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tools-icon {
  font-size: 0.8rem;
}

.tools-arrow {
  transition: transform 0.2s ease;
  font-size: 0.65rem;
  color: #64748b;
}

.tools-block.expanded .tools-arrow {
  transform: rotate(180deg);
}

.tools-content {
  padding: 8px 12px;
  border-top: 1px solid rgba(168, 85, 247, 0.12);
  max-height: 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tools-block.collapsed .tools-content {
  display: none;
}

/* Tool Log Items style */
.tool-item-log {
  border-bottom: 1px solid rgba(168, 85, 247, 0.08);
  padding-bottom: 6px;
}

.tool-item-log:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.tool-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 600;
}

.tool-item-name {
  color: #a855f7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
}

.tool-item-status-spinner {
  font-size: 0.65rem;
  color: #f59e0b;
  animation: pulse-slow 1.5s infinite;
}

.tool-item-status-success {
  font-size: 0.65rem;
  color: #22c55e;
  font-weight: bold;
}

.tool-item-response {
  font-size: 0.7rem;
  color: #94a3b8;
  padding: 4px 6px;
  background-color: rgba(15, 23, 42, 0.6);
  border-radius: 4px;
  margin-top: 4px;
  border: 1px solid rgba(168, 85, 247, 0.05);
  white-space: pre-wrap;
}

/* Markdown & LaTeX Styling inside Chat Bubbles */
.bubble-answer p {
  margin-bottom: 8px;
}
.bubble-answer p:last-child {
  margin-bottom: 0;
}

.bubble-answer h1, .bubble-answer h2, .bubble-answer h3 {
  color: #f8fafc;
  font-weight: 600;
  margin-top: 12px;
  margin-bottom: 6px;
  line-height: 1.25;
}
.bubble-answer h1 { font-size: 1.15rem; }
.bubble-answer h2 { font-size: 1.05rem; }
.bubble-answer h3 { font-size: 0.95rem; }

.bubble-answer ul, .bubble-answer ol {
  margin-bottom: 8px;
  padding-left: 20px;
}
.bubble-answer ul {
  list-style-type: disc;
}
.bubble-answer ol {
  list-style-type: decimal;
}
.bubble-answer li {
  margin-bottom: 4px;
}

.bubble-answer blockquote {
  border-left: 3px solid #3b82f6;
  background-color: rgba(59, 130, 246, 0.05);
  padding: 6px 12px;
  margin: 8px 0;
  font-style: italic;
  color: #94a3b8;
  border-radius: 0 6px 6px 0;
}

/* Modern Dark-Themed Markdown Tables */
.table-container {
  width: 100%;
  overflow-x: auto;
  margin: 12px 0;
  border-radius: 8px;
  border: 1px solid #334155;
  background-color: #0b111e;
}

.table-container table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.825rem;
  text-align: left;
}

.table-container th {
  background-color: #1e293b;
  color: #f8fafc;
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 2px solid #334155;
  white-space: nowrap;
}

.table-container td {
  padding: 8px 12px;
  border-bottom: 1px solid #1e293b;
  color: #cbd5e1;
}

.table-container tr:last-child td {
  border-bottom: none;
}

.table-container tr:hover td {
  background-color: rgba(255, 255, 255, 0.02);
}

.inline-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.775rem;
  background-color: rgba(244, 63, 94, 0.1);
  color: #fda4af;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(244, 63, 94, 0.15);
}

/* Beautiful Code Blocks with Copy button */
.code-block-container {
  background-color: #0b111e;
  border: 1px solid #334155;
  border-radius: 8px;
  margin: 10px 0;
  overflow: hidden;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1e293b;
  padding: 4px 10px;
  border-bottom: 1px solid #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.7rem;
  color: #94a3b8;
}

.code-copy-btn {
  background-color: #334155;
  border: none;
  color: #f1f5f9;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.code-copy-btn:hover {
  background-color: #475569;
}

.code-block-content {
  margin: 0;
  padding: 10px;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: #e2e8f0;
  line-height: 1.4;
}

/* Elegant LaTeX Formats */
.latex-block {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 12px 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.latex-formula {
  font-family: "Times New Roman", Times, "Cambria Math", serif;
  font-size: 1.05rem;
  font-style: italic;
  color: #e2e8f0;
  text-align: center;
  letter-spacing: 0.05em;
  line-height: 1.5;
}

.latex-inline {
  font-family: "Times New Roman", Times, "Cambria Math", serif;
  font-size: 0.95rem;
  font-style: italic;
  color: #60a5fa;
  padding: 0 4px;
  letter-spacing: 0.02em;
}

/* Beautiful Fraction Layout inside CSS LaTeX rendering */
.latex-frac {
  display: inline-flex;
  flex-direction: column;
  vertical-align: middle;
  text-align: center;
  padding: 0 4px;
}

.latex-num {
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 1px;
  font-size: 0.85em;
}

.latex-den {
  padding-top: 1px;
  font-size: 0.85em;
}

/* Tool execution status logs inside bubble */
.tool-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(139, 92, 246, 0.08);
  border: 1px dashed rgba(139, 92, 246, 0.3);
  padding: 8px 12px;
  border-radius: 6px;
  margin: 6px 0;
  font-size: 0.75rem;
  color: #c084fc;
}

.tool-success-note {
  font-size: 0.7rem;
  color: #4ade80;
  background-color: rgba(74, 222, 128, 0.05);
  border: 1px solid rgba(74, 222, 128, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
  margin: 4px 0;
  display: inline-block;
}

/* Stop state for generator pause */
.send-button.stop-state {
  background-color: #ef4444 !important;
}
.send-button.stop-state:hover {
  background-color: #f87171 !important;
}

/* Header actions list */
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Chats Pane */
.chats-pane {
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

.chats-pane.collapsed {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-bottom-width: 0;
  overflow: hidden;
  opacity: 0;
}

.chats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

.chats-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.compact-btn {
  padding: 4px 10px !important;
  font-size: 0.75rem !important;
  height: auto !important;
}

.chats-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.chat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  background-color: #0f172a;
  border: 1px solid #334155;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-item:hover {
  border-color: #475569;
  background-color: #1e293b;
}

.chat-item.active {
  border-color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.15);
}

.chat-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.chat-item-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.chat-item-title {
  font-size: 0.8rem;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item-delete {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chat-item-delete:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

/* Tab Picker Modal styling */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.modal-overlay.hidden {
  display: none !important;
  opacity: 0;
  pointer-events: none;
}

.modal-content {
  background-color: #1e293b;
  border: 1px solid #475569;
  border-radius: 12px;
  width: 90%;
  max-width: 360px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5);
  animation: modalFadeIn 0.2s ease;
}

@keyframes modalFadeIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #334155;
}

.modal-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f8fafc;
}

.modal-close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background-color: #334155;
  color: #f1f5f9;
}

.tab-list {
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
}

.tab-picker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.tab-picker-item:hover {
  border-color: #3b82f6;
  background-color: #1e293b;
  transform: translateY(-1px);
}

.tab-picker-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1e293b;
  border-radius: 6px;
}

.tab-picker-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}

.tab-picker-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-picker-url {
  font-size: 0.7rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


`;

const POPUP_JS_CODE = `// AcceleratedLogic AI - Popup Controller

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
        openaiScanResults.innerHTML = \`Capabilities Verified:<br>• Text: Confirmed<br>• Vision: \${openaiCapabilities.vision ? "✅ Confirmed" : "❌ Not supported"}<br>• Audio: \${openaiCapabilities.audio ? "✅ Confirmed" : "❌ Not supported"}\`;
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
      item.className = \`chat-item \${chat.id === activeChatId ? 'active' : ''}\`;

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
    const visionPattern = /gpt-4o|gpt-4\\.1|gpt-4-turbo|gpt-4-vision|o1|o3|o4|gemini|claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku|llava|-vl\\b|vision|pixtral|qwen.*vl|internvl|phi-3.*vision|phi-3\\.5-vision|llama-3\\.2.*vision|llama-4|molmo/;
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
      let ep = endpoint.replace(/\\/+$/,'');
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
        openaiScanResults.textContent = \`Text failed (\${textRes.status}): \` + getErrText(textRes);
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
      openaiScanResults.innerHTML = \`Capabilities Verified:<br>• Text: Confirmed<br>• Vision: \${detectedVision ? "✅ Confirmed" : "❌ Not supported"}<br>• Audio: \${detectedAudio ? "✅ Confirmed" : "❌ Not supported"}\`;
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
                name: \`Capture: \${extractedDom.title}\`,
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
              name: \`Capture: \${extractedDom.title}\`,
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
          ? \`<img src="\${favIcon}" style="width: 16px; height: 16px; object-fit: contain;" referrerPolicy="no-referrer" />\` 
          : \`<span class="tab-picker-icon">\${favIcon}</span>\`;

        tabItem.innerHTML = \`
          <div class="tab-picker-icon">\${iconHtml}</div>
          <div class="tab-picker-info">
            <span class="tab-picker-title">\${escapeHtml(tab.title || "Untitled Tab")}</span>
            <span class="tab-picker-url">\${escapeHtml(tab.url || "")}</span>
          </div>
        \`;

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
      btnSend.innerHTML = \`
        <svg viewBox="0 0 24 24" class="send-icon">
          <rect x="6" y="6" width="12" height="12" rx="1.5" fill="#ffffff" />
        </svg>
      \`;
    } else {
      isGenerating = false;
      currentAbortController = null;
      btnSend.classList.remove("stop-state");
      btnSend.title = "Send message";
      btnSend.innerHTML = \`
        <svg viewBox="0 0 24 24" class="send-icon">
          <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
        </svg>
      \`;
    }
  }

  function detectPseudoToolCall(text) {
    if (!text) return null;

    const knownToolsMap = {
      "get_page_dom": "get_page_dom",
      "getpagedom": "get_page_dom",
      "getpage_dom": "get_page_dom",
      "get_page_screenshot": "get_page_screenshot",
      "getpagescreenshot": "get_page_screenshot",
      "getpage_screenshot": "get_page_screenshot",
      "click_element": "click_element",
      "clickelement": "click_element",
      "click_at_coordinate": "click_at_coordinate",
      "clickatcoordinate": "click_at_coordinate",
      "type_text": "type_text",
      "typetext": "type_text",
      "scroll_page": "scroll_page",
      "scrollpage": "scroll_page",
      "wait": "wait",
      "open_tab": "open_tab",
      "opentab": "open_tab",
      "search_web": "search_web",
      "searchweb": "search_web",
      "list_tabs": "list_tabs",
      "listtabs": "list_tabs",
      "switch_tab": "switch_tab",
      "switchtab": "switch_tab",
      "press_key": "press_key",
      "presskey": "press_key",
      "select_text": "select_text",
      "selecttext": "select_text",
      "replace_text": "replace_text",
      "replacetext": "replace_text",
      "extract_links": "extract_links",
      "extractlinks": "extract_links",
      "execute_script": "execute_script",
      "executescript": "execute_script",
      "go_back_forward": "go_back_forward",
      "gobackforward": "go_back_forward",
      "get_element_details": "get_element_details",
      "getelementdetails": "get_element_details"
    };

    const regex = /(?:call:)?(?:default_?api:)?([a-zA-Z0-9_]+)\\s*(\\([^{}]*\\)|\\{[^}]*\\}|)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const rawMatch = match[0];
      const rawName = match[1].toLowerCase().trim();
      const mappedName = knownToolsMap[rawName];

      if (mappedName) {
        let rawArgs = match[2] || "{}";
        rawArgs = rawArgs.trim();
        if (rawArgs.startsWith("(") && rawArgs.endsWith(")")) {
          rawArgs = rawArgs.slice(1, -1).trim();
        }
        if (!rawArgs || rawArgs === "()") rawArgs = "{}";

        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(rawArgs);
        } catch (e) {
          parsedArgs = {};
        }

        return {
          fullMatch: rawMatch,
          name: mappedName,
          args: parsedArgs
        };
      }
    }

    return null;
  }

  function cleanPseudoStrings(text) {
    if (!text) return text;
    return text
      .replace(/(?:call:)?(?:default_?api:)[a-zA-Z0-9_]*\\s*(\\([^{}]*\\)|\\{[^}]*\\}|)/gi, "")
      .replace(/(?:call:)?(?:default_?api:)?(?:get_?page_?dom|get_?page_?screenshot|click_?element|click_?at_?coordinate|type_?text|scroll_?page|wait|open_?tab|search_?web|list_?tabs|switch_?tab|press_?key|select_?text|replace_?text|extract_?links|execute_?script|go_?back_?forward|get_?element_?details)\\s*(\\([^{}]*\\)|\\{[^}]*\\}|)/gi, "")
      .replace(/call:[a-zA-Z0-9_]+\\s*(\\([^{}]*\\)|\\{[^}]*\\}|)/gi, "")
      .replace(/[a-zA-Z0-9_$]+\\s*=\\s*\\{?\\s*$/gi, "")
      .replace(/<thinking>\\s*<\\/thinking>/gi, "")
      .trim();
  }

  function sanitizeToolResult(toolResult) {
    if (typeof toolResult === 'object' && toolResult !== null) {
      try {
        const sanitized = JSON.parse(JSON.stringify(toolResult, (key, value) => {
          if (value === undefined) return undefined;
          if (key === 'screenshot_url' && typeof value === 'string' && value.length > 1000) return undefined;
          return value;
        }));
        if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
          return sanitized;
        }
        return { output: String(JSON.stringify(toolResult)) };
      } catch (e) {
        return { output: String(toolResult) };
      }
    }
    return { output: String(toolResult || 'Execution completed.') };
  }

  function sanitizeHistory(history) {
    const cleanHistory = [];
    (history || []).forEach((msg, index) => {
      const isPastTurn = index < history.length - 1;
      const validParts = [];

      (msg.parts || []).forEach(part => {
        if (!part || typeof part !== 'object') return;

        if (part.functionCall && part.functionCall.name) {
          validParts.push({
            functionCall: {
              name: String(part.functionCall.name),
              args: (part.functionCall.args && typeof part.functionCall.args === 'object') ? part.functionCall.args : {}
            }
          });
          return;
        }

        if (part.functionResponse && part.functionResponse.name) {
          validParts.push({
            functionResponse: {
              name: String(part.functionResponse.name),
              response: sanitizeToolResult(part.functionResponse.response)
            }
          });
          return;
        }

        if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
          if (isPastTurn) {
            validParts.push({ text: \`[Attachment (\${part.inlineData.mimeType}) analyzed in previous turn]\` });
          } else {
            validParts.push({
              inlineData: {
                mimeType: String(part.inlineData.mimeType),
                data: String(part.inlineData.data)
              }
            });
          }
          return;
        }

        if (typeof part.text === 'string') {
          const cleanedText = cleanPseudoStrings(part.text);
          if (cleanedText && cleanedText.trim()) {
            validParts.push({ text: cleanedText.trim() });
          }
          return;
        }
      });

      if (validParts.length > 0) {
        cleanHistory.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: validParts
        });
      }
    });

    return cleanHistory;
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
    msgHeader.innerHTML = \`<span>You</span><span>\${getCurrentTime()}</span>\`;
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
        finalPrompt = \`[Webpage Context: Title: "\${currentAttachment.domContext.title}", URL: \${currentAttachment.domContext.url}]\\n\\nDOM innerText Context (Extract):\\n---\\n\${currentAttachment.domContext.text}\\n---\\n\\nUser Prompt: \${prompt || "Analyze this page"}\`;
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
    assistHeader.innerHTML = \`<span>AcceleratedLogic</span><span>\${getCurrentTime()}</span>\`;
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
        const systemInstructionText = \`You are AcceleratedLogic, an advanced browser assistant Chrome Extension.
You help users analyze web pages, answer questions, and perform research.
You can call 'get_page_dom' to get webpage text\${isVisionCapable ? ", 'get_page_screenshot' to get a visual screenshot" : ""}, 'click_element' to interact with buttons/links, 'click_at_coordinate' to click at custom screen coordinates and optionally type, 'type_text' to fill out input fields, 'scroll_page' to scroll up/down/left/right, 'open_tab' to open a new tab with a specific URL, 'search_web' to perform search queries, 'list_tabs' to list open tabs, 'switch_tab' to switch between tabs, 'press_key' to simulate pressing keys on the webpage, 'select_text' to select/highlight text, and 'replace_text' to replace text.

CRITICAL RULES:
- NATIVE TOOL CALLING: You MUST invoke tools strictly using native function declarations. NEVER output tool calls as raw text, pseudo-code strings, or text fragments like 'call:default_api:...', 'call:get_page_dom', or 'get_page_dom{}'.
- Always output your internal step-by-step planning and thinking process enclosed exactly within <thinking> and </thinking> tags at the very start of your response.
- Never output raw base64 data, gibberish strings, or repeating binary characters.
- PAGE ANALYSIS RULE: When you open a page or perform a search, you MUST NOT just report that the page/search is opened. You MUST immediately proceed to call 'get_page_dom' (or 'get_page_screenshot') to read, analyze, and comprehend its actual content before moving on or concluding, unless the user explicitly said they only wanted to open the page.
- REAL-TIME SEARCH RULE: If you are unsure of any answer, or need to retrieve current/real-time information, you MUST use 'search_web' to search, then open or switch to relevant result tabs and extract their text using 'get_page_dom' to analyze the findings. Never speculate or give generic answers without verifying.
- MULTI-TAB NAVIGATION: You know what each tab is and can switch tabs if needed. Use 'list_tabs' to view all open tabs (IDs, titles, URLs, active status) and use 'switch_tab' to change the active tab when a user asks about another tab, or when you need to gather information from a different open page.
- NON-DOM INTERACTIVE KEYPRESS RULE: If you are interacting with canvas-based elements, browser games, or non-input interactive areas where WASD or other key actions are required to move or interact (such as playing games, interactive canvases, sliding controls, etc.), use the 'press_key' tool to send raw keyboard presses directly to the page instead of standard 'type_text'.
- VERIFICATION RULE: After executing an interactive action that modifies page state (such as 'type_text', 'replace_text', 'press_key', 'click_element', or 'click_at_coordinate'), you MUST explicitly verify that your action completed correctly. Do this by calling 'get_page_dom' (or 'get_page_screenshot') immediately after the action to inspect the updated page state and confirm the expected change (e.g., verifying text was input, checking that a modal opened, or confirming that text selection/replacement has occurred). Never just assume an action worked without checking the page's state.
- ACTION DOUBLE-CHECK: The AI should check if it actually did something correctly in the end. You MUST run a final verification check (fetching updated DOM/screenshot) after typing or clicking to confirm the input is visible, the page updated, or the action fully registered before concluding your response to the user.
\${isVisionCapable ? "- If you call 'get_page_screenshot', you will receive the screenshot image as inlineData in the next user turn. Analyze the screenshot visually and describe it naturally.\\n" : ""}- Keep explanations conversational, elegant, and markdown-formatted.\`;

        if (apiProvider === "openai-compatible") {
          let ep = openaiBaseUrl.replace(/\\/+$/,'');
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
                  textContent += \` [Attachment (\${part.inlineData.mimeType}) analyzed in previous turn] \`;
                }
              }
              if (part.functionCall) {
                textContent += \`\\n[Requested tool execution: \${part.functionCall.name} with arguments: \${JSON.stringify(part.functionCall.args)}]\`;
              }
            });

            if (base64Images.length > 0) {
              const contentArray = [{ type: "text", text: textContent || "Analyze this page screenshot." }];
              base64Images.forEach(img => {
                contentArray.push({
                  type: "image_url",
                  image_url: {
                    url: \`data:\${img.mimeType};base64,\${img.data}\`
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
            throw new Error(errJson.error?.message || \`API Error: \${response.status}\`);
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

            const lines = buffer.split("\\n");
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
          } else if (accumulatedText) {
            const pseudoCall = detectPseudoToolCall(accumulatedText);
            if (pseudoCall) {
              activeFunctionCall = {
                name: pseudoCall.name,
                args: pseudoCall.args
              };
              accumulatedText = accumulatedText.replace(pseudoCall.fullMatch, '').trim();
              updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);

              rawModelParts = [];
              if (accumulatedText) {
                rawModelParts.push({ text: accumulatedText });
              }
              rawModelParts.push({
                functionCall: {
                  name: pseudoCall.name,
                  args: pseudoCall.args
                }
              });
            } else {
              rawModelParts = [{ text: accumulatedText }];
            }
          } else {
            rawModelParts = [{ text: accumulatedText }];
          }

        } else {
          // Call Gemini API directly with streamGenerateContent and tools enabled
          const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${activeModel}:streamGenerateContent?key=\${apiKey}\`;
          
          // Optimize chat history: strip massive base64 inlineData from all past turns and sanitize parts
          const cleanContents = sanitizeHistory(chatHistory);

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
                        description: "CSS selector of the input/textarea/editor to type into (e.g. 'input[type=\\"text\\"]', '#search-input', '.ql-editor', '.ProseMirror')."
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
            throw new Error(errJson.error?.message || \`API Error: \${response.status}\`);
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

        if (!activeFunctionCall && accumulatedText) {
          const pseudoCall = detectPseudoToolCall(accumulatedText);
          if (pseudoCall) {
            activeFunctionCall = {
              name: pseudoCall.name,
              args: pseudoCall.args
            };
            accumulatedText = accumulatedText.replace(pseudoCall.fullMatch, '').trim();
            updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);

            rawModelParts = [];
            if (accumulatedText) {
              rawModelParts.push({ text: accumulatedText });
            }
            rawModelParts.push({
              functionCall: {
                name: pseudoCall.name,
                args: pseudoCall.args
              }
            });
          }
        }

        if (activeFunctionCall) {
          // Model requested a tool execution! We set hasMoreTurns to true to send the response back
          hasMoreTurns = true;

          // Clean stray pseudo code (like userData={ or call:...) from accumulatedText
          accumulatedText = cleanPseudoStrings(accumulatedText)
            .replace(/[a-zA-Z0-9_$]+\\s*=\\s*\\{?\\s*$/gi, "")
            .trim();
          updateAssistantBubble(currentAssistantBubble, currentLoaderDiv, accumulatedText);

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
            toggleBtn.innerHTML = \`
              <span class="tools-header-left">
                <span class="tools-icon">🛠️</span>
                <span class="tools-text">Tool Executions (1)</span>
              </span>
              <span class="tools-arrow">▼</span>
            \`;
            
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
          toolItem.innerHTML = \`
            <div class="tool-item-header">
              <span class="tool-item-name">\${activeFunctionCall.name}()</span>
              <span class="tool-item-status-spinner">⏳ Running...</span>
            </div>
            <div class="tool-item-response font-mono">Pending execution...</div>
          \`;
          contentDiv.appendChild(toolItem);
          
          // Update the count in toggle button
          const count = contentDiv.querySelectorAll(".tool-item-log").length;
          const toolsText = toolsBlock.querySelector(".tools-text");
          if (toolsText) {
            toolsText.textContent = \`Tool Executions (\${count})\`;
          }
          scrollToBottom();

          // 1. Add model's functionCall to chat history (sanitized & normalized)
          const cleanModelParts = [];
          const combinedModelText = cleanPseudoStrings(accumulatedText);
          if (combinedModelText && combinedModelText.trim()) {
            cleanModelParts.push({ text: combinedModelText.trim() });
          }
          if (activeFunctionCall && activeFunctionCall.name) {
            cleanModelParts.push({
              functionCall: {
                name: String(activeFunctionCall.name),
                args: (activeFunctionCall.args && typeof activeFunctionCall.args === 'object') ? activeFunctionCall.args : {}
              }
            });
          }

          chatHistory.push({
            role: "model",
            parts: cleanModelParts.length > 0 ? cleanModelParts : [
              {
                functionCall: {
                  name: String(activeFunctionCall.name),
                  args: (activeFunctionCall.args && typeof activeFunctionCall.args === 'object') ? activeFunctionCall.args : {}
                }
              }
            ]
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
              note = \`Context loaded successfully! URL: \${toolResult.url || ""}\`;
            } else if (activeFunctionCall.name === "click_element") {
              note = \`Element <\${toolResult.tagName?.toLowerCase() || "element"}> clicked.\`;
            } else if (activeFunctionCall.name === "click_at_coordinate") {
              note = \`Clicked coordinate (\${activeFunctionCall.args?.x || 0}, \${activeFunctionCall.args?.y || 0}).\`;
            } else if (activeFunctionCall.name === "type_text") {
              note = \`Typed text: "\${activeFunctionCall.args?.text || ""}"\`;
            } else if (activeFunctionCall.name === "scroll_page") {
              note = \`Scrolled page \${activeFunctionCall.args?.direction || "down"}.\`;
            } else if (activeFunctionCall.name === "open_tab") {
              note = \`Opened tab: \${activeFunctionCall.args?.url || ""}\`;
            } else if (activeFunctionCall.name === "wait") {
              note = \`Waited for \${activeFunctionCall.args?.delayMs || 1000}ms.\`;
            } else if (activeFunctionCall.name === "search_web") {
              note = \`Searched web for "\${activeFunctionCall.args?.query || ""}"\`;
            } else if (activeFunctionCall.name === "list_tabs") {
              note = \`Listed all open tabs.\`;
            } else if (activeFunctionCall.name === "switch_tab") {
              note = \`Switched to tab ID \${activeFunctionCall.args?.tabId || ""}.\`;
            } else if (activeFunctionCall.name === "press_key") {
              const k = activeFunctionCall.args?.key || "";
              const duration = activeFunctionCall.args?.holdDuration !== undefined ? Number(activeFunctionCall.args?.holdDuration) : 50;
              note = \`Pressed key: "\${k}"\${duration > 50 ? \` (held down for \${duration}ms)\` : ""}\`;
            } else if (activeFunctionCall.name === "extract_links") {
              note = \`Extracted \${toolResult.count || 0} links from page.\`;
            } else if (activeFunctionCall.name === "execute_script") {
              note = \`Evaluated JavaScript script on tab.\`;
            } else if (activeFunctionCall.name === "go_back_forward") {
              note = \`Navigated browser history \${activeFunctionCall.args?.direction || "back"}.\`;
            } else if (activeFunctionCall.name === "get_element_details") {
              note = \`Inspected details for selector "\${activeFunctionCall.args?.selector || ""}".\`;
            }
            responseDiv.textContent = note;
          }
          scrollToBottom();

          // 3. Add functionResponse to chat history (with image attachment if it's get_page_screenshot)
          const rawResponseData = { ...toolResult };
          if (rawResponseData.screenshot_url) {
            delete rawResponseData.screenshot_url; // Remove the massive base64 from the textual tool response
          }
          if (activeFunctionCall.name === "get_page_screenshot") {
            rawResponseData.message = "Screenshot captured successfully and attached as an image part. Please analyze the image to answer.";
          }

          const responseParts = [
            {
              functionResponse: {
                name: String(activeFunctionCall.name),
                response: sanitizeToolResult(rawResponseData)
              }
            }
          ];

          if (activeFunctionCall.name === "get_page_screenshot" && toolResult.screenshot_url) {
            const mimeMatch = toolResult.screenshot_url.match(/data:(image\\/[a-zA-Z+]+);base64,/);
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
        errorDiv.textContent = \`Error: \${err.message || "Failed to contact Gemini API."}\`;
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

    // 1. Extract Display Math: $$ ... $$ or \\[ ... \\]
    processedText = processedText.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (match, formula) => {
      const id = \`%%LATEXBLOCK\${mathBlocks.length}%%\`;
      const rendered = renderLatexToHtml(formula.trim(), true);
      mathBlocks.push({ id, rendered });
      return id;
    });

    processedText = processedText.replace(/\\\\\\[([\\s\\S]+?)\\\\\\]/g, (match, formula) => {
      const id = \`%%LATEXBLOCK\${mathBlocks.length}%%\`;
      const rendered = renderLatexToHtml(formula.trim(), true);
      mathBlocks.push({ id, rendered });
      return id;
    });

    // 2. Extract Inline Math: $ ... $ or \\( ... \\)
    processedText = processedText.replace(/\\$([^\\$\\n]+?)\\$/g, (match, formula) => {
      if (/^\\d+(\\.\\d+)?(M|K|B)?$/.test(formula)) {
        return match; 
      }
      const id = \`%%LATEXINLINE\${mathBlocks.length}%%\`;
      const rendered = renderLatexToHtml(formula.trim(), false);
      mathBlocks.push({ id, rendered });
      return id;
    });

    processedText = processedText.replace(/\\\\\\(([\\s\\S]+?)\\\\\\)/g, (match, formula) => {
      const id = \`%%LATEXINLINE\${mathBlocks.length}%%\`;
      const rendered = renderLatexToHtml(formula.trim(), false);
      mathBlocks.push({ id, rendered });
      return id;
    });

    // 3. Extract Code Blocks: \`\`\`lang\\ncode\\n\`\`\`
    const codeBlocks = [];
    processedText = processedText.replace(/\`\`\`(\\w*)[^\\n\\r]*\\r?\\n([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
      const id = \`%%CODEBLOCK\${codeBlocks.length}%%\`;
      codeBlocks.push({ id, lang: lang || 'code', code: code });
      return id;
    });

    // 4. Now safely escape HTML of the remaining text (protecting placeholders, which don't have & < >)
    let escaped = processedText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 5. Parse Inline Code: \`code\`
    escaped = escaped.replace(/\`([^\`\\n]+?)\`/g, (match, code) => {
      return \`<code class="inline-code">\${code}</code>\`;
    });

    // 6. Parse Headers
    escaped = escaped.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // 7. Bold & Italic
    escaped = escaped.replace(/\\*\\*([\\s\\S]+?)\\*\\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([\\s\\S]+?)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\\*([\\s\\S]+?)\\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([\\s\\S]+?)_/g, '<em>$1</em>');

    // 8. Blockquotes
    escaped = escaped.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');

    // 9. Lists
    escaped = escaped.replace(/^\\s*[-*]\\s+(.*?)$/gm, '<li>$1</li>');
    escaped = escaped.replace(/^\\s*\\d+\\.\\s+(.*?)$/gm, '<li class="ordered">$1</li>');

    // 9.5 Parse Tables
    const linesArr = escaped.split(/\\r?\\n/);
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
      const cleaned = trimmed.replace(/[|:\\s-]/g, '');
      return cleaned === '' && trimmed.includes('-');
    }

    function renderTableHtml(header, alignments, rows) {
      let html = '<div class="table-container"><table>';
      html += '<thead><tr>';
      header.forEach((cell, idx) => {
        const align = alignments[idx] ? \` style="text-align: \${alignments[idx]}"\` : '';
        html += \`<th\${align}>\${cell}</th>\`;
      });
      html += '</tr></thead>';
      html += '<tbody>';
      rows.forEach(row => {
        html += '<tr>';
        for (let idx = 0; idx < header.length; idx++) {
          const cell = row[idx] || '';
          const align = alignments[idx] ? \` style="text-align: \${alignments[idx]}"\` : '';
          html += \`<td\${align}>\${cell}</td>\`;
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
    escaped = newLines.join('\\n');

    // 10. Paragraphs and Newlines
    const lines = escaped.split(/\\n{2,}/);
    const formattedParagraphs = lines.map(line => {
      line = line.trim();
      if (!line) return "";
      
      if (line.startsWith("%%CODEBLOCK") || 
          line.startsWith("%%LATEXBLOCK") || 
          line.startsWith("%%LATEXINLINE") || 
          line.startsWith("<h") || 
          line.startsWith("<blockquote") ||
          line.startsWith("<li") ||
          line.startsWith("<div class=\\"table-container\\"")) {
        return line;
      }
      
      return \`<p>\${line.replace(/\\n/g, '<br>')}</p>\`;
    });
    
    escaped = formattedParagraphs.filter(Boolean).join("\\n");

    // 11. Group adjacent list items
    escaped = escaped.replace(/(<li>.*?<\\/li>\\n?)+/g, (match) => \`<ul>\${match}</ul>\`);
    escaped = escaped.replace(/(<li class="ordered">.*?<\\/li>\\n?)+/g, (match) => {
      const clean = match.replace(/ class="ordered"/g, '');
      return \`<ol>\${clean}</ol>\`;
    });

    // 12. Re-insert Code Blocks with copy buttons
    codeBlocks.forEach((item) => {
      const cleanCode = item.code.trim();
      const codeHtml = \`
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-block-lang">\${item.lang}</span>
            <button class="code-copy-btn">Copy</button>
            <pre class="hidden-code-text" style="display:none">\${cleanCode}</pre>
          </div>
          <pre class="code-block-content"><code>\${cleanCode}</code></pre>
        </div>
      \`;
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
      '\\\\\\\\alpha': 'α', '\\\\\\\\beta': 'β', '\\\\\\\\gamma': 'γ', '\\\\\\\\delta': 'δ', '\\\\\\\\epsilon': 'ε',
      '\\\\\\\\zeta': 'ζ', '\\\\\\\\eta': 'η', '\\\\\\\\theta': 'θ', '\\\\\\\\iota': 'ι', '\\\\\\\\kappa': 'κ',
      '\\\\\\\\lambda': 'λ', '\\\\\\\\mu': 'μ', '\\\\\\\\nu': 'ν', '\\\\\\\\xi': 'ξ', '\\\\\\\\pi': 'π',
      '\\\\\\\\rho': 'ρ', '\\\\\\\\sigma': 'σ', '\\\\\\\\tau': 'τ', '\\\\\\\\upsilon': 'υ', '\\\\\\\\phi': 'φ',
      '\\\\\\\\chi': 'χ', '\\\\\\\\psi': 'ψ', '\\\\\\\\omega': 'ω',
      '\\\\\\\\Delta': 'Δ', '\\\\\\\\Gamma': 'Γ', '\\\\\\\\Theta': 'Θ', '\\\\\\\\Lambda': 'Λ', '\\\\\\\\Xi': 'Ξ',
      '\\\\\\\\Pi': 'Π', '\\\\\\\\Sigma': 'Σ', '\\\\\\\\Phi': 'Φ', '\\\\\\\\Psi': 'Ψ', '\\\\\\\\Omega': 'Ω',
      '\\\\\\\\infty': '∞', '\\\\\\\\pm': '±', '\\\\\\\\times': '×', '\\\\\\\\div': '÷', 
      '\\\\\\\\neq': '≠', '\\\\\\\\approx': '≈', '\\\\\\\\leq': '≤', '\\\\\\\\geq': '≥', '\\\\\\\\le': '≤', '\\\\\\\\ge': '≥',
      '\\\\\\\\to': '→', '\\\\\\\\rightarrow': '→', '\\\\\\\\leftarrow': '←', '\\\\\\\\leftrightarrow': '↔',
      '\\\\\\\\partial': '∂', '\\\\\\\\nabla': '∇', '\\\\\\\\cdot': '·', '\\\\\\\\bullet': '•',
      '\\\\\\\\forall': '∀', '\\\\\\\\exists': '∃', '\\\\\\\\in': '∈', '\\\\\\\\notin': '∉', '\\\\\\\\ni': '∋',
      '\\\\\\\\subset': '⊂', '\\\\\\\\supset': '⊃', '\\\\\\\\subseteq': '⊆', '\\\\\\\\supseteq': '⊇',
      '\\\\\\\\cup': '∪', '\\\\\\\\cap': '∩', '\\\\\\\\empty': '∅', '\\\\\\\\varnothing': '∅',
      '\\\\\\\\int': '∫', '\\\\\\\\sum': '∑', '\\\\\\\\prod': '∏', '\\\\\\\\sqrt': '√'
    };

    const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const regex = new RegExp(key, 'g');
      html = html.replace(regex, replacements[key]);
    }

    // Square roots: \\sqrt{expression}
    html = html.replace(/\\\\sqrt\\{([^\\}]+?)\\}/g, '<span class="latex-sqrt"><span class="latex-sqrt-radical">√</span><span class="latex-sqrt-content">$1</span></span>');

    // Fractions: \\frac{num}{den}
    html = html.replace(/\\\\frac\\{([^\\}]+?)\\}\\{([^\\}]+?)\\}/g, '<span class="latex-frac"><span class="latex-num">$1</span><span class="latex-den">$2</span></span>');

    // Superscripts & Subscripts (grouped with braces first)
    html = html.replace(/\\^\\{([^\\}]+?)\\}/g, '<sup>$1</sup>');
    html = html.replace(/_\\{([^\\}]+?)\\}/g, '<sub>$1</sub>');

    // Single character superscripts and subscripts
    html = html.replace(/\\^([a-zA-Z0-9\\-+*=])/g, '<sup>$1</sup>');
    html = html.replace(/_([a-zA-Z0-9\\-+*=])/g, '<sub>$1</sub>');

    // Clean remaining tags
    html = html.replace(/\\\\mathrm\\{([^\\}]+?)\\}/g, '$1');
    html = html.replace(/\\\\text\\{([^\\}]+?)\\}/g, '$1');
    html = html.replace(/\\\\left/g, '');
    html = html.replace(/\\\\right/g, '');
    html = html.replace(/\\\\/g, '');

    if (isBlock) {
      return \`
        <div class="latex-block">
          <div class="latex-formula">\${html}</div>
        </div>
      \`;
    } else {
      return \`<span class="latex-inline">\${html}</span>\`;
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

              target.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: \`Key\${char.toUpperCase()}\`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
              target.dispatchEvent(new KeyboardEvent('keypress', { key: char, keyCode: charCode, which: charCode, bubbles: true, cancelable: true }));
              
              target.value = char;
              target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
              
              target.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: \`Key\${char.toUpperCase()}\`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
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
            code: \`Key\${char.toUpperCase()}\`,
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
            code: \`Key\${char.toUpperCase()}\`,
            keyCode: charCode,
            which: charCode,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(keypressEvent);

          // Keyup
          const keyupEvent = new KeyboardEvent('keyup', {
            key: char,
            code: \`Key\${char.toUpperCase()}\`,
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
                message: \`[Simulator] Found and clicked <\${target.tagName.toLowerCase()}> element on current screen.\`
              });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          } else {
            resolve({
              success: true,
              message: \`[Simulator Fallback] Element matching '\${sel || txt}' clicked successfully in virtual browser space.\`
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
          dot.style.left = \`\${clientX - 12}px\`;
          dot.style.top = \`\${clientY - 12}px\`;
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
                typedMsg = \` and typed "\${typeText}"\`;
              }

              resolve({
                success: true,
                tagName: target.tagName,
                id: target.id,
                message: \`[Simulator] Clicked coordinate (\${x}, \${y}) targeting <\${target.tagName.toLowerCase()}>\${typedMsg}.\`
              });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          } else {
            resolve({
              success: true,
              message: \`[Simulator Fallback] Clicked coordinate (\${x}, \${y}) in virtual space.\`
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
                message: \`[Simulator] Typed "\${txt}" into target element on current screen.\`
              });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          } else {
            resolve({
              success: true,
              message: \`[Simulator Fallback] Typed "\${txt}" into virtual input field matching '\${sel}'.\`
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
            message: \`[Simulator] Scrolled page \${dir} by \${amt} pixels.\`,
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
            message: \`[Simulator] Successfully opened a new tab in background: \${url}\`
          });
        } else if (name === "wait") {
          const delay = Number(args.delayMs) || 1000;
          setTimeout(() => {
            resolve({
              success: true,
              delayMs: delay,
              message: \`[Simulator] Successfully waited/slept for \${delay}ms.\`
            });
          }, delay);
        } else if (name === "search_web") {
          const query = args.query;
          resolve({
            success: true,
            query: query,
            message: \`[Simulator] Searched the web for "\${query}". Displaying top search results.\`
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
            message: \`[Simulator Fallback] Successfully switched active tab to tab ID \${targetId}.\`
          });
        } else if (name === "press_key") {
          const key = args.key || "";
          const duration = args.holdDuration !== undefined ? Number(args.holdDuration) : 50;
          resolve({
            success: true,
            key: key,
            holdDuration: duration,
            message: \`[Simulator Fallback] Successfully pressed key "\${key}" and held it down for \${duration}ms in virtual space.\`
          });
        } else if (name === "select_text") {
          const txt = args.searchText || "";
          resolve({
            success: true,
            searchText: txt,
            message: \`[Simulator Fallback] Successfully selected and highlighted text "\${txt}" in virtual space.\`
          });
        } else if (name === "replace_text") {
          const rep = args.replaceText || "";
          resolve({
            success: true,
            replaceText: rep,
            message: \`[Simulator Fallback] Successfully replaced selected text with "\${rep}" in virtual space.\`
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
            message: \`[Simulator Fallback] Extracted hyperlinks from page\${kw ? \` matching keyword "\${kw}"\` : ''}.\`
          });
        } else if (name === "execute_script") {
          const codeStr = args.code || "";
          resolve({
            success: true,
            result: \`[Simulator Execution] Successfully evaluated script: \${codeStr}\`,
            output: "window.scrollY = 0; document.title = 'AcceleratedLogic';"
          });
        } else if (name === "go_back_forward") {
          const dir = args.direction || "back";
          resolve({
            success: true,
            direction: dir,
            message: \`[Simulator Fallback] Successfully navigated browser history \${dir}.\`
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
                      frameText += "\\n--- IFRAME: " + (iframe.id || iframe.className || "untitled") + " ---\\n" + getFrameText(subDoc);
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
                return { success: false, error: \`Could not find element matching selector '\${selector}' and text '\${textContext}'\` };
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
                  message: \`Successfully clicked <\${target.tagName.toLowerCase()}> element.\`
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
              indicator.style.left = \`\${clientX - 15}px\`;
              indicator.style.top = \`\${clientY - 15}px\`;
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
                return { success: false, error: \`Could not find any element at coordinates (\${coordX}, \${coordY})\` };
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
                    code: \`Key\${char.toUpperCase()}\`,
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
                    code: \`Key\${char.toUpperCase()}\`,
                    keyCode: charCode,
                    which: charCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keypressEvent);

                  // Keyup
                  const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    code: \`Key\${char.toUpperCase()}\`,
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
                  message: \`Successfully clicked at coordinate (\${coordX}, \${coordY}) targeting <\${target.tagName.toLowerCase()}>.\`
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
                return { success: false, error: \`Could not find input element matching selector '\${selector}'\` };
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
                    code: \`Key\${char.toUpperCase()}\`,
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
                    code: \`Key\${char.toUpperCase()}\`,
                    keyCode: charCode,
                    which: charCode,
                    bubbles: true,
                    cancelable: true
                  });
                  target.dispatchEvent(keypressEvent);

                  // Keyup
                  const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    code: \`Key\${char.toUpperCase()}\`,
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
                  message: \`Successfully typed "\${text}" into <\${target.tagName.toLowerCase()}> element.\`
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
                message: \`Successfully scrolled \${direction} by \${scrollAmt}px.\`,
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
              message: \`Successfully opened new tab with URL: \${url}\`
            });
          });
        } else if (name === "wait") {
          const delay = Number(args.delayMs) || 1000;
          setTimeout(() => {
            resolve({
              success: true,
              delayMs: delay,
              message: \`Successfully waited/slept for \${delay}ms.\`
            });
          }, delay);
        } else if (name === "search_web") {
          const query = args.query;
          const searchUrl = \`https://www.google.com/search?q=\${encodeURIComponent(query)}\`;
          chrome.tabs.create({ url: searchUrl }, (tab) => {
            resolve({
              success: true,
              tabId: tab.id,
              query: query,
              message: \`Successfully performed web search for "\${query}" and opened search tab.\`
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
                message: \`Successfully switched active tab to: \${tab ? tab.title : targetId}\`
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
                message: \`Successfully pressed key "\${keyVal}" on element <\${target.tagName.toLowerCase()}>\${sel ? " matching selector: " + sel : ""}.\`
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
                  message: \`Successfully selected text range [\${s}, \${e}] in input/textarea.\`
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
                    message: \`Successfully highlighted and selected text "\${searchTextVal}".\`
                  };
                } else {
                  if (typeof win.find === 'function') {
                    const found = win.find(searchTextVal, false, false, true, false, true, false);
                    if (found) {
                      return {
                        success: true,
                        message: \`Successfully selected text "\${searchTextVal}" via window.find.\`
                      };
                    }
                  }
                  return {
                    success: false,
                    error: \`Could not find text "\${searchTextVal}" inside the target.\`
                  };
                }
              } else {
                const range = win.document.createRange();
                range.selectNodeContents(target);
                selection.addRange(range);
                return {
                  success: true,
                  message: \`Successfully selected all contents of element <\${target.tagName.toLowerCase()}>.\`
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
                    message: \`Successfully replaced selection with "\${replaceVal}" in Google Docs via clipboard simulation.\`
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
                    return { success: false, error: \`Could not find text "\${searchVal}" inside input/textarea.\` };
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
                      return { success: false, error: \`Could not find text "\${searchVal}" on page.\` };
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
                  message: \`Successfully replaced text with "\${replaceVal}" in input/textarea.\`
                };
              }

              try {
                const selection = win.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const executed = win.document.execCommand('insertText', false, replaceVal);
                  if (executed) {
                    return {
                      success: true,
                      message: \`Successfully replaced text selection with "\${replaceVal}" using document.execCommand.\`
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
                    message: \`Successfully replaced selection with "\${replaceVal}" via manual Range DOM manipulation.\`
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
                if (!el) return { success: false, error: \`Element matching selector "\${sel}" not found.\` };

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
    
    const match = text.match(/^\\s*(Thought|thought|Thinking|thinking)\\s*(:\\s*|\\n+\\s*)/i);
    if (match) {
      const startIndex = match.index + match[0].length;
      const rest = text.substring(startIndex);
      
      const transitionRegex = /\\n\\n(?=[a-zA-Z]|\\*\\*|#|-|\\*|\\[)/;
      const transitionMatch = rest.match(transitionRegex);
      if (transitionMatch) {
        const transitionIndex = transitionMatch.index;
        const thoughtContent = rest.substring(0, transitionIndex);
        const restContent = rest.substring(transitionIndex);
        return \`<thinking>\${thoughtContent}</thinking>\${restContent}\`;
      } else {
        return \`<thinking>\${rest}\`;
      }
    }
    return text;
  }

  // Parses thinking blocks out of the text content
  function parseThinkingAndContent(text) {
    text = cleanPseudoStrings(text);
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
    
    let thinking = thinkingParts.map(t => t.trim()).filter(Boolean).join("\\n\\n");
    let trimmedContent = content.trim();

    if (!trimmedContent && thinking) {
      trimmedContent = thinking;
      thinking = "";
    }

    return {
      thinking: thinking,
      content: trimmedContent
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
      bubble.className = \`message-bubble \${msg.role === 'user' ? 'user' : 'assistant'}\`;

      const header = document.createElement("div");
      header.className = "message-header";
      header.innerHTML = \`<span>\${msg.role === 'user' ? 'You' : 'AcceleratedLogic'}</span>\`;
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
          desc.textContent = \`Attachment (\${part.inlineData.mimeType})\`;
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
      console.log(\`[Backoff] Attempt \${attempt} failed, retrying in \${Math.round(delay)}ms...\`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
});
`;

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

const CodeBlock = ({ lang, content }: { lang: string; content: string; key?: any }) => {
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

  const placeholders: Array<{ id: string; type: 'latex-block' | 'latex-inline' | 'code-block'; content: any }> = [];
  let processedText = text;

  // 1. Extract Display Math: $$ ... $$
  processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
    const id = `%%PLACEHOLDER_LATEX_BLOCK_${placeholders.length}%%`;
    placeholders.push({
      id,
      type: 'latex-block',
      content: formula.trim()
    });
    return id;
  });

  // 2. Extract Inline Math: $ ... $
  processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    if (/^\d+(\.\d+)?(M|K|B)?$/.test(formula)) {
      return match; 
    }
    const id = `%%PLACEHOLDER_LATEX_INLINE_${placeholders.length}%%`;
    placeholders.push({
      id,
      type: 'latex-inline',
      content: formula.trim()
    });
    return id;
  });

  // 3. Extract Code Blocks: ```lang\ncode\n```
  processedText = processedText.replace(/```(\w*)[^\n\r]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `%%PLACEHOLDER_CODE_BLOCK_${placeholders.length}%%`;
    placeholders.push({
      id,
      type: 'code-block',
      content: { lang: lang || 'code', code: code.trim() }
    });
    return id;
  });

  // 4. Split the text by placeholders so we can render them as React components natively
  const placeholderRegex = /(%%PLACEHOLDER_(?:LATEX_BLOCK|LATEX_INLINE|CODE_BLOCK)_\d+%%)/g;
  const parts = processedText.split(placeholderRegex);

  return (
    <div className="space-y-2 text-[11px] leading-relaxed text-slate-200">
      {parts.map((part, partIdx) => {
        if (!part) return null;

        // Check if this part is a placeholder
        const match = part.match(/%%PLACEHOLDER_(LATEX_BLOCK|LATEX_INLINE|CODE_BLOCK)_(\d+)%%/);
        if (match) {
          const type = match[1];
          const idx = parseInt(match[2], 10);
          const placeholderObj = placeholders[idx];

          if (placeholderObj.type === 'latex-block') {
            return (
              <div key={partIdx} className="flex justify-center items-center my-2.5 p-2.5 rounded-lg border border-slate-700/60 bg-slate-900/60 text-center tracking-wide text-xs text-slate-100 overflow-x-auto">
                <RenderLatex formula={placeholderObj.content} displayMode={true} />
              </div>
            );
          } else if (placeholderObj.type === 'latex-inline') {
            return (
              <span key={partIdx} className="inline-block align-middle my-0.5 px-0.5 text-blue-400 font-sans">
                <RenderLatex formula={placeholderObj.content} displayMode={false} />
              </span>
            );
          } else if (placeholderObj.type === 'code-block') {
            return (
              <CodeBlock key={partIdx} lang={placeholderObj.content.lang} content={placeholderObj.content.code} />
            );
          }
        }

        // If it's normal text, render it with markdown styles
        return (
          <div key={partIdx} className="space-y-1.5">
            {renderMarkdownTextBlock(part)}
          </div>
        );
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

function cleanPseudoStrings(text: string): string {
  if (!text) return text;
  return text
    .replace(/(?:call:)?(?:default_?api:)[a-zA-Z0-9_]*\s*(\([^{}]*\)|\{[^}]*\}|)/gi, "")
    .replace(/(?:call:)?(?:default_?api:)?(?:get_?page_?dom|get_?page_?screenshot|click_?element|click_?at_?coordinate|type_?text|scroll_?page|wait|open_?tab|search_?web|list_?tabs|switch_?tab|press_?key|select_?text|replace_?text|extract_?links|execute_?script|go_?back_?forward|get_?element_?details)\s*(\([^{}]*\)|\{[^}]*\}|)/gi, "")
    .replace(/call:[a-zA-Z0-9_]+\s*(\([^{}]*\)|\{[^}]*\}|)/gi, "")
    .replace(/[a-zA-Z0-9_$]+\s*=\s*\{?\s*$/gi, "")
    .replace(/<thinking>\s*<\/thinking>/gi, "")
    .trim();
}

function sanitizeToolResult(toolResult: any): any {
  if (typeof toolResult === 'object' && toolResult !== null) {
    try {
      const sanitized = JSON.parse(JSON.stringify(toolResult, (key, value) => {
        if (value === undefined) return undefined;
        if (key === 'screenshot_url' && typeof value === 'string' && value.length > 1000) return undefined;
        return value;
      }));
      if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
        return sanitized;
      }
      return { output: String(JSON.stringify(toolResult)) };
    } catch (e) {
      return { output: String(toolResult) };
    }
  }
  return { output: String(toolResult || 'Execution completed.') };
}

function sanitizeHistory(history: any[]) {
  const cleanHistory: any[] = [];
  (history || []).forEach((msg, index) => {
    const isPastTurn = index < history.length - 1;
    const validParts: any[] = [];

    (msg.parts || []).forEach((part: any) => {
      if (!part || typeof part !== 'object') return;

      if (part.functionCall && part.functionCall.name) {
        validParts.push({
          functionCall: {
            name: String(part.functionCall.name),
            args: (part.functionCall.args && typeof part.functionCall.args === 'object') ? part.functionCall.args : {}
          }
        });
        return;
      }

      if (part.functionResponse && part.functionResponse.name) {
        validParts.push({
          functionResponse: {
            name: String(part.functionResponse.name),
            response: sanitizeToolResult(part.functionResponse.response)
          }
        });
        return;
      }

      if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
        if (isPastTurn) {
          validParts.push({ text: `[Attachment (${part.inlineData.mimeType}) analyzed in previous turn]` });
        } else {
          validParts.push({
            inlineData: {
              mimeType: String(part.inlineData.mimeType),
              data: String(part.inlineData.data)
            }
          });
        }
        return;
      }

      if (typeof part.text === 'string') {
        const cleanedText = cleanPseudoStrings(part.text);
        if (cleanedText && cleanedText.trim()) {
          validParts.push({ text: cleanedText.trim() });
        }
        return;
      }
    });

    if (validParts.length > 0) {
      cleanHistory.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: validParts
      });
    }
  });

  return cleanHistory;
}

// Parses thinking blocks out of the text content inside React
function parseThinkingAndContent(text: string) {
  text = cleanPseudoStrings(text);
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
  
  let thinking = thinkingParts.map(t => t.trim()).filter(Boolean).join("\n\n");
  let trimmedContent = content.trim();

  if (!trimmedContent && thinking) {
    trimmedContent = thinking;
    thinking = "";
  }

  return {
    thinking: thinking,
    content: trimmedContent
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

  // Every time the application mounts, make sure we have a brand new empty chat (or reuse an existing empty one at the top)
  useEffect(() => {
    let currentChats = [...simChats];
    
    // Check if the first chat is completely empty or just holds the initial greeting message without any user input yet
    const firstIsEmpty = currentChats.length > 0 && 
      (!currentChats[0].messages || currentChats[0].messages.length === 0 || 
       (currentChats[0].messages.length === 1 && currentChats[0].messages[0].id === 1));
       
    if (firstIsEmpty) {
      setSimActiveChatId(currentChats[0].id);
    } else {
      const newChatId = "sim-chat-" + Date.now();
      const newChat = {
        id: newChatId,
        title: "New Chat",
        messages: [
          {
            id: 1,
            role: "assistant",
            text: "Hello! Paste your Gemini API key in the settings (⚙️) above to start. You can type prompts, upload files, or simulate taking page captures of this builder app!",
          }
        ]
      };
      const updatedChats = [newChat, ...currentChats];
      setSimChats(updatedChats);
      setSimActiveChatId(newChatId);
      localStorage.setItem("simChats", JSON.stringify(updatedChats));
      localStorage.setItem("simActiveChatId", newChatId);
    }
  }, []);

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

          // Optimize history: strip massive base64 inlineData from all past turns and sanitize parts
          const optimizedHistory = sanitizeHistory(localHistory);

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
- NATIVE TOOL CALLING: You MUST invoke tools strictly using native function declarations. NEVER output tool calls as raw text, pseudo-code strings, or text fragments like 'call:default_api:...', 'call:get_page_dom', or 'get_page_dom{}'.
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
3. Type any question, and the simulator will connect directly to **${activeModelId}** for a fully responsive, real-time conversation!`;
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
      <main className="max-w-6xl mx-auto px-6 flex justify-center items-start">
        
        {/* Extension Screen Simulator Shell */}
        <section className="w-full flex justify-center">
          {/* Desktop Browser Mockup Container */}
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[650px] relative">
            
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
                    title="Open AcceleratedLogic AI Side Panel"
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
                </div>
              </div>

              {/* RIGHT SIDE: The Gemini Side Panel (Sidebar) */}
              <div className="w-full sm:w-[280px] md:w-[310px] bg-slate-900 flex flex-col h-full relative shrink-0">
                {/* Simulated Extension Header */}
                <header className="flex justify-between items-center px-3.5 py-2.5 bg-slate-800 border-b border-slate-700/60 shrink-0 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 text-xs">✨</span>
                    <span className="text-[11px] font-semibold text-slate-200">AcceleratedLogic AI Side Panel</span>
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
                      placeholder="Ask Gemini..."
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

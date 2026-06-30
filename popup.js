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

  // Extension State
  let apiKey = "";
  let modelId = "gemini-2.5-flash";
  let activeAttachment = null; // { name, size, mimeType, base64, domContext }
  let chatHistory = []; // list of { role: 'user'|'model', parts: [{text}, {inlineData}] }

  // 1. Initial Load & Hydrate Settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["apiKey", "modelId", "customModelId", "chatHistory"], (result) => {
      if (result.apiKey) {
        apiKey = result.apiKey;
        inputApiKey.value = apiKey;
        welcomeKeyWarning.style.display = "none";
      } else {
        welcomeKeyWarning.style.display = "block";
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

      if (result.chatHistory && result.chatHistory.length > 0) {
        chatHistory = result.chatHistory;
        welcomeScreen.style.display = "none";
        renderHistory();
      }
    });
  } else {
    // Fallback for development/testing outside of extension container
    console.log("Not running inside Chrome Extension context. Storage simulation active.");
  }

  // Auto-resize prompt text area
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = (promptInput.scrollHeight) + "px";
  });

  // Toggle settings pane visibility
  btnSettings.addEventListener("click", () => {
    settingsPane.classList.toggle("collapsed");
  });

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

  // Model selection listener
  selectModel.addEventListener("change", () => {
    if (selectModel.value === "custom") {
      customModelGroup.style.display = "block";
    } else {
      customModelGroup.style.display = "none";
    }
  });

  // Save Settings Clicked
  btnSaveSettings.addEventListener("click", () => {
    apiKey = inputApiKey.value.trim();
    let selectedVal = selectModel.value;
    
    if (selectedVal === "custom") {
      modelId = inputCustomModel.value.trim() || "gemini-2.5-flash";
    } else {
      modelId = selectedVal;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        apiKey: apiKey,
        modelId: selectedVal,
        customModelId: inputCustomModel.value.trim()
      }, () => {
        settingsPane.classList.add("collapsed");
        if (apiKey) {
          welcomeKeyWarning.style.display = "none";
        } else {
          welcomeKeyWarning.style.display = "block";
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

  // Capture Page Screenshot + DOM
  menuCapturePage.addEventListener("click", () => {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.captureVisibleTab) {
      showToast("Screenshot capture only works inside real chrome browser!");
      return;
    }

    // Capture tab details
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        showToast("No active browser tab found.");
        return;
      }
      
      const activeTab = tabs[0];
      
      // Inject script to read DOM content
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          return {
            title: document.title,
            url: window.location.href,
            text: document.body ? document.body.innerText.substring(0, 50000) : ""
          };
        }
      }, (results) => {
        let extractedDom = {
          title: activeTab.title,
          url: activeTab.url,
          text: ""
        };

        if (results && results[0] && results[0].result) {
          extractedDom = results[0].result;
        }

        // Capture visible screenshot
        chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (screenshotUrl) => {
          if (!screenshotUrl) {
            // If capturing fails due to restricted page (e.g. chrome:// tabs)
            showToast("Failed to capture screen (restricted tab). Using DOM context only.");
            // We can use a transparent pixel fallback so it still works
            screenshotUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
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
      });
    });
  });

  // Set active attachment state and display preview
  function setAttachment(attachmentObj) {
    activeAttachment = attachmentObj;
    attachmentNameElement.textContent = attachmentObj.name;
    attachmentSizeElement.textContent = attachmentObj.size;
    
    if (attachmentObj.mimeType.startsWith("image/")) {
      attachmentTypeIcon.textContent = "🖼️";
    } else if (attachmentObj.mimeType.includes("pdf")) {
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

  async function sendMessage() {
    const prompt = promptInput.value.trim();
    if (!prompt && !activeAttachment) return;

    if (!apiKey) {
      showToast("Please enter your Gemini API Key in Settings first!");
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
    assistHeader.innerHTML = `<span>Gemini</span><span>${getCurrentTime()}</span>`;
    assistantBubble.appendChild(assistHeader);

    const loaderDiv = document.createElement("div");
    loaderDiv.className = "loading-indicator";
    loaderDiv.innerHTML = '<div class="spinner"></div> <span>Gemini is thinking...</span>';
    assistantBubble.appendChild(loaderDiv);

    chatLog.appendChild(assistantBubble);
    scrollToBottom();

    try {
      // Determine correct model name
      let activeModel = modelId;
      if (activeModel === "custom") {
        activeModel = inputCustomModel.value.trim() || "gemini-2.5-flash";
      }

      // Call Gemini API directly
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: chatHistory
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error?.message || `API Error: ${response.status}`);
      }

      const resData = await response.json();
      const assistantText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!assistantText) {
        throw new Error("Empty response received from Gemini API.");
      }

      // Update Assistant Bubble with Text
      loaderDiv.remove();
      const textDiv = document.createElement("div");
      textDiv.className = "bubble-text";
      textDiv.textContent = assistantText;
      assistantBubble.appendChild(textDiv);

      // Append assistant response to history list
      chatHistory.push({
        role: "model",
        parts: [{ text: assistantText }]
      });

      // Save history to local storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ chatHistory: chatHistory });
      }

    } catch (err) {
      console.error(err);
      loaderDiv.remove();
      
      const errorDiv = document.createElement("div");
      errorDiv.className = "bubble-text";
      errorDiv.style.color = "#f87171";
      errorDiv.textContent = `Error: ${err.message || "Failed to contact Gemini API."}`;
      assistantBubble.appendChild(errorDiv);

      // Remove last user message from history so they can retry it easily
      chatHistory.pop();
    }

    scrollToBottom();
  }

  // Render chat history from local storage
  function renderHistory() {
    chatHistory.forEach(msg => {
      const bubble = document.createElement("div");
      bubble.className = `message-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;

      const header = document.createElement("div");
      header.className = "message-header";
      header.innerHTML = `<span>${msg.role === 'user' ? 'You' : 'Gemini'}</span>`;
      bubble.appendChild(header);

      // Render parts
      msg.parts.forEach(part => {
        if (part.text) {
          const body = document.createElement("div");
          body.className = "bubble-text";
          
          // Truncate webpage DOM dumps in history rendering to keep clean
          let text = part.text;
          if (text.includes("DOM innerText Context")) {
            const index = text.indexOf("User Prompt:");
            if (index !== -1) {
              text = "[Attached Webpage context] " + text.substring(index);
            }
          }
          
          body.textContent = text;
          bubble.appendChild(body);
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
});

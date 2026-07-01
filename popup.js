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
  let apiKey = "";
  let modelId = "gemini-2.5-flash";
  let activeAttachment = null; // { name, size, mimeType, base64, domContext }
  let chats = []; // list of { id, title, history }
  let activeChatId = null;
  let chatHistory = []; // list of { role: 'user'|'model', parts: [{text}, {inlineData}] }
  let isGenerating = false;
  let currentAbortController = null;

  // 1. Initial Load & Hydrate Settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["apiKey", "modelId", "customModelId", "chats", "activeChatId", "chatHistory"], (result) => {
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
        hasMoreTurns = false;
        let activeFunctionCall = null;

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
              text: "You are Gemini Web Companion, an advanced browser assistant Chrome Extension.\nYou help users analyze web pages, answer questions, and perform research.\nYou can call 'get_page_dom' to get webpage text, 'get_page_screenshot' to get a visual screenshot, 'click_element' to interact with buttons/links, and 'type_text' to fill out input fields.\n\nCRITICAL RULES:\n- Always output your internal step-by-step planning and thinking process enclosed exactly within <thinking> and </thinking> tags at the very start of your response.\n- Never output raw base64 data, gibberish strings, or repeating binary characters.\n- If you call 'get_page_screenshot', you will receive the screenshot image as inlineData in the next user turn. Analyze the screenshot visually and describe it naturally.\n- Keep explanations conversational, elegant, and markdown-formatted."
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
              {
                name: "get_page_screenshot",
                description: "Captures a visual screenshot of the current visible tab's viewport as base64 JPEG image data.",
                parameters: {
                  type: "OBJECT",
                  properties: {}
                }
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
        };

        const response = await fetch(url, {
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

        if (activeFunctionCall) {
          // Model requested a tool execution! We set hasMoreTurns to true to send the response back
          hasMoreTurns = true;

          if (currentLoaderDiv && currentLoaderDiv.parentNode === currentAssistantBubble) {
            currentLoaderDiv.remove();
          }

          // Show status spinner in bubble
          const toolStatus = document.createElement("div");
          toolStatus.className = "tool-status-indicator";
          toolStatus.innerHTML = `
            <div class="spinner"></div>
            <span>AI called <code>${activeFunctionCall.name}()</code>. Fetching active context...</span>
          `;
          currentAssistantBubble.appendChild(toolStatus);
          scrollToBottom();

          // 1. Add model's functionCall to chat history
          chatHistory.push({
            role: "model",
            parts: [{ functionCall: activeFunctionCall }]
          });

          // 2. Execute the tool
          const toolResult = await executeTool(activeFunctionCall.name, activeFunctionCall.args);

          // Remove the status spinner
          toolStatus.remove();

          // Show tool success tag
          const toolSuccessMsg = document.createElement("div");
          toolSuccessMsg.className = "tool-success-note";
          toolSuccessMsg.innerHTML = `⚙️ Executed tool <code>${activeFunctionCall.name}</code> successfully.`;
          currentAssistantBubble.appendChild(toolSuccessMsg);
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

            currentAssistantBubble.appendChild(imgContainer);
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
            parts: [{ text: accumulatedText }]
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
    
    // Escape HTML first to prevent XSS
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const latexBlocks = [];
    const latexInlines = [];

    // Match block math: $$ ... $$ or \[ ... \]
    escaped = escaped.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
      const id = `__LATEX_BLOCK_${latexBlocks.length}__`;
      latexBlocks.push(formula.trim());
      return id;
    });
    
    escaped = escaped.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
      const id = `__LATEX_BLOCK_${latexBlocks.length}__`;
      latexBlocks.push(formula.trim());
      return id;
    });

    // Match inline math: $ ... $ (avoiding double $ and things like $10 or $5.50)
    escaped = escaped.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      if (/^\d+(\.\d+)?(M|K|B)?$/.test(formula)) {
        return match; 
      }
      const id = `__LATEX_INLINE_${latexInlines.length}__`;
      latexInlines.push(formula.trim());
      return id;
    });

    escaped = escaped.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
      const id = `__LATEX_INLINE_${latexInlines.length}__`;
      latexInlines.push(formula.trim());
      return id;
    });

    // Parse Code Blocks: ```lang\ncode\n```
    const codeBlocks = [];
    escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push({ lang: lang || 'code', code: code });
      return id;
    });

    // Parse Inline Code: `code`
    escaped = escaped.replace(/`([^`\n]+?)`/g, (match, code) => {
      return `<code class="inline-code">${code}</code>`;
    });

    // Parse Headers
    escaped = escaped.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Bold & Italic
    escaped = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([\s\S]+?)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([\s\S]+?)_/g, '<em>$1</em>');

    // Blockquotes
    escaped = escaped.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');

    // Lists
    escaped = escaped.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
    escaped = escaped.replace(/^\s*\d+\.\s+(.*?)$/gm, '<li class="ordered">$1</li>');

    // Paragraphs and Newlines
    const lines = escaped.split(/\n{2,}/);
    const formattedParagraphs = lines.map(line => {
      line = line.trim();
      if (!line) return "";
      
      if (line.startsWith("__CODE_BLOCK_") || 
          line.startsWith("__LATEX_BLOCK_") || 
          line.startsWith("<h") || 
          line.startsWith("<blockquote") ||
          line.startsWith("<li")) {
        return line;
      }
      
      return `<p>${line.replace(/\n/g, '<br>')}</p>`;
    });
    
    escaped = formattedParagraphs.filter(Boolean).join("\n");

    // Group adjacent list items
    escaped = escaped.replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    escaped = escaped.replace(/(<li class="ordered">.*?<\/li>\n?)+/g, (match) => {
      const clean = match.replace(/ class="ordered"/g, '');
      return `<ol>${clean}</ol>`;
    });

    // Re-insert Code Blocks with copy buttons
    codeBlocks.forEach((item, index) => {
      const placeholder = `__CODE_BLOCK_${index}__`;
      const cleanCode = item.code.trim();
      const codeHtml = `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-block-lang">${item.lang}</span>
            <button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 1500)">Copy</button>
            <pre class="hidden-code-text" style="display:none">${cleanCode}</pre>
          </div>
          <pre class="code-block-content"><code>${cleanCode}</code></pre>
        </div>
      `;
      escaped = escaped.replace(placeholder, codeHtml);
    });

    // Re-insert LaTeX Blocks with serif equations
    latexBlocks.forEach((formula, index) => {
      const placeholder = `__LATEX_BLOCK_${index}__`;
      const mathHtml = `
        <div class="latex-block">
          <div class="latex-formula">${renderLatexToHtml(formula)}</div>
        </div>
      `;
      escaped = escaped.replace(placeholder, mathHtml);
    });

    // Re-insert LaTeX Inlines
    latexInlines.forEach((formula, index) => {
      const placeholder = `__LATEX_INLINE_${index}__`;
      const mathHtml = `<span class="latex-inline">${renderLatexToHtml(formula)}</span>`;
      escaped = escaped.replace(placeholder, mathHtml);
    });

    return escaped;
  }

  // Unicode LaTeX math parser
  function renderLatexToHtml(formula) {
    let html = formula;

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

    // Superscripts & Subscripts
    html = html.replace(/\^\{([^\}]+?)\}/g, '<sup>$1</sup>');
    html = html.replace(/\^([a-zA-Z0-9\-+\*=]+)/g, '<sup>$1</sup>');
    html = html.replace(/_\{([^\}]+?)\}/g, '<sub>$1</sub>');
    html = html.replace(/_([a-zA-Z0-9\-+\*=]+)/g, '<sub>$1</sub>');

    // Fractions: \frac{num}{den}
    html = html.replace(/\\frac\{([^\}]+?)\}\{([^\}]+?)\}/g, '<span class="latex-frac"><span class="latex-num">$1</span><span class="latex-den">$2</span></span>');

    // Clear LaTeX formatting tags
    html = html.replace(/\\mathrm\{([^\}]+?)\}/g, '$1');
    html = html.replace(/\\text\{([^\}]+?)\}/g, '$1');
    html = html.replace(/\\left/g, '');
    html = html.replace(/\\right/g, '');
    html = html.replace(/\\/g, '');

    return html;
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
    return new Promise((resolve) => {
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
        } else if (name === "type_text") {
          const sel = args.selector || "";
          const txt = args.text || "";
          let target = null;
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
              resolve({
                success: true,
                tagName: target.tagName,
                id: target.id,
                message: `[Simulator] Typed "${txt}" into input field on current screen.`
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
              return {
                title: document.title,
                url: window.location.href,
                text: document.body ? document.body.innerText.substring(0, 50000) : ""
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
              let elements = [];
              if (selector) {
                try {
                  elements = Array.from(document.querySelectorAll(selector));
                } catch (e) {
                  return { success: false, error: "Invalid selector: " + selector };
                }
              } else if (textContext) {
                elements = Array.from(document.querySelectorAll("button, a, input, [role='button'], span, p, div"));
              } else {
                return { success: false, error: "No selector or textContext specified." };
              }

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
        } else if (name === "type_text") {
          const sel = args.selector || "";
          const txt = args.text || "";
          const submit = !!args.submitAfter;
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [sel, txt, submit],
            func: (selector, text, submitAfter) => {
              let target;
              try {
                target = document.querySelector(selector);
              } catch (e) {
                return { success: false, error: "Invalid selector: " + selector };
              }

              if (!target) {
                return { success: false, error: `Could not find input element matching selector '${selector}'` };
              }

              try {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.focus();

                if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
                  target.value = text;
                } else if (target.isContentEditable) {
                  target.innerText = text;
                } else {
                  return { success: false, error: `Element matching selector '${selector}' is not an input, textarea or contenteditable element.` };
                }

                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));

                if (submitAfter) {
                  const form = target.form;
                  if (form) {
                    if (form.requestSubmit) form.requestSubmit();
                    else form.submit();
                  } else {
                    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    target.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                  }
                }

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
        } else {
          resolve({ error: "Unknown tool" });
        }
      });
    });
  }

  // Parses thinking blocks out of the text content
  function parseThinkingAndContent(text) {
    let thinking = "";
    let content = text;
    
    const thinkingStartTag = "<thinking>";
    const thinkingEndTag = "</thinking>";
    
    const startIndex = text.indexOf(thinkingStartTag);
    if (startIndex !== -1) {
      const endIndex = text.indexOf(thinkingEndTag);
      if (endIndex !== -1) {
        // Complete thinking block
        thinking = text.substring(startIndex + thinkingStartTag.length, endIndex);
        content = text.substring(0, startIndex) + text.substring(endIndex + thinkingEndTag.length);
      } else {
        // Thinking block is still open (streaming)
        thinking = text.substring(startIndex + thinkingStartTag.length);
        content = text.substring(0, startIndex);
      }
    }
    
    return {
      thinking: thinking.trim(),
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
});

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
  let isGenerating = false;
  let currentAbortController = null;

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
        
        const payload = {
          contents: chatHistory,
          systemInstruction: {
            parts: [{
              text: "You are Gemini Web Companion, an advanced browser assistant Chrome Extension.\nYou help users analyze web pages, answer questions, and perform research.\nYou can call 'get_page_dom' to get webpage text, or 'get_page_screenshot' to get a visual screenshot.\n\nCRITICAL RULES:\n- Never output raw base64 data, gibberish strings, or repeating binary characters (like ryandsqt/W2W2W2... or other base64 fragments).\n- If you call 'get_page_screenshot', you will receive the screenshot image as inlineData in the next user turn. Analyze the screenshot visually and describe it naturally to answer the user's specific query.\n- Keep explanations conversational, elegant, and markdown-formatted."
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
                      accumulatedText += part.text;
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
          const responseParts = [
            {
              functionResponse: {
                name: activeFunctionCall.name,
                response: toolResult
              }
            }
          ];

          if (activeFunctionCall.name === "get_page_screenshot" && toolResult.screenshot_url) {
            const mimeMatch = toolResult.screenshot_url.match(/data:(image\/[a-zA-Z+]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            const base64Data = toolResult.screenshot_url.split(",")[1];
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
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ chatHistory: chatHistory });
          }
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
            screenshot_url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
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
              resolve({
                success: true,
                screenshot_url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
                message: "Failed to capture visual screenshot (restricted system tab). Fallback active."
              });
            } else {
              resolve({
                success: true,
                screenshot_url: screenshotUrl
              });
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

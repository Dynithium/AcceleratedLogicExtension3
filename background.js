// Gemini Web Companion - Background Script
// This background worker listens for installation events.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Gemini Web Companion Chrome Extension installed successfully.");
});

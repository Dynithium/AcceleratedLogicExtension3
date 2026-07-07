// AcceleratedLogic AI - Background Script
// This background worker listens for installation events.

chrome.runtime.onInstalled.addListener(() => {
  console.log("AcceleratedLogic AI Chrome Extension installed successfully.");
});

// Enable opening the side panel on clicking the action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

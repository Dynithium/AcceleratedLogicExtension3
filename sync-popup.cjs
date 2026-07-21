const fs = require('fs');

let popupJs = fs.readFileSync('popup.js', 'utf8');
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

const startMarker = 'const POPUP_JS_CODE = `';
const endMarker = '`;\n\n// React Formatting & LaTeX math parser using';

const startIdx = appTsx.indexOf(startMarker);
const endIdx = appTsx.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find POPUP_JS_CODE markers!", startIdx, endIdx);
  process.exit(1);
}

const escapedPopupJs = popupJs
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\${/g, '\\${');

const newAppTsx = appTsx.substring(0, startIdx + startMarker.length) + escapedPopupJs + appTsx.substring(endIdx);
fs.writeFileSync('src/App.tsx', newAppTsx, 'utf8');
console.log("Successfully synced POPUP_JS_CODE in src/App.tsx!");

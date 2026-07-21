const fs = require('fs');
['popup.js', 'src/App.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/functionResponse: {\s*name: activeFunctionCall\.name,\s*response: toolResult\s*}/g, 
    'functionResponse: { id: activeFunctionCall.id || undefined, name: activeFunctionCall.name, response: toolResult }');
  fs.writeFileSync(file, content, 'utf8');
});
console.log("Fixed ID");

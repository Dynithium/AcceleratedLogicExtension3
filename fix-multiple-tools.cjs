const fs = require('fs');

['popup.js', 'src/App.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/if \(validParts\.length > 0\) \{\s*cleanHistory\.push\(\{/g, `if (validParts.length > 0) {
      let finalParts = validParts;
      if (msg.role === 'model') {
        const fnCalls = validParts.filter(p => p.functionCall);
        if (fnCalls.length > 1) {
          // Keep text parts and ONLY the FIRST function call
          finalParts = validParts.filter(p => !p.functionCall || p === fnCalls[0]);
        }
      }
      cleanHistory.push({`);
      
  fs.writeFileSync(file, content, 'utf8');
});
console.log("Fixed multiple tools logic");

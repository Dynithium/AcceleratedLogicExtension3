const fs = require('fs');
let code = fs.readFileSync('popup.js', 'utf8');

// extract sanitizeHistory function and test it
const sanitizeMatch = code.match(/function sanitizeHistory\(([\s\S]*?)\n  \}/);
if (sanitizeMatch) {
  eval("function sanitizeHistory(" + sanitizeMatch[1] + "\n  }");
  const chatHistory = [
    {
      role: 'user',
      parts: [ { text: 'look at this page' } ]
    },
    {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'get_page_dom',
            args: {}
          }
        }
      ]
    },
    {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'get_page_dom',
            response: { result: 'Context loaded successfully!' }
          }
        }
      ]
    }
  ];
  
  console.log(JSON.stringify(sanitizeHistory(chatHistory), null, 2));
}

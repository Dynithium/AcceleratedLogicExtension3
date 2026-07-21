const fs = require('fs');
['popup.js', 'src/App.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/errJson\.error\?\.message\s*\|\|\s*`API Error: \${response\.status}`/g, 
    'errJson.error?.message || errJson.message || (Object.keys(errJson).length ? JSON.stringify(errJson) : `API Error: ${response.status}`)');
  
  content = content.replace(/errJson\.error\?\.message\s*\|\|\s*\\`API Error: \\\${response\.status}\\`/g, 
    'errJson.error?.message || errJson.message || (Object.keys(errJson).length ? JSON.stringify(errJson) : \\`API Error: \\${response.status}\\`)');

  fs.writeFileSync(file, content, 'utf8');
});
console.log("Done");

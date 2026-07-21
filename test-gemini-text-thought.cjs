const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

async function run() {
  const payload2 = {
    contents: [
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [
        {
          text: "hello" // MISSING thoughtSignature that the model originally generated!
        }
      ]}, 
      { role: "user", parts: [ { text: "how are you" } ] }
    ],
    tools: [{
      functionDeclarations: [
        { name: "get_page_screenshot", description: "Gets a screenshot", parameters: {type: "OBJECT", properties: {}} },
      ]
    }]
  };

  const response2 = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload2)
  });
  const json2 = await response2.json();
  console.log("Status:", response2.status);
  console.log("Response:", JSON.stringify(json2, null, 2));
}

run();

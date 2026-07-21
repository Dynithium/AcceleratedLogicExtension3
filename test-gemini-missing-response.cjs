const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

async function run() {
  // First get a real response with multiple tools
  const payload1 = {
    contents: [{ role: "user", parts: [{ text: "Please call get_page_screenshot AND get_page_dom" }] }],
    tools: [{
      functionDeclarations: [
        { name: "get_page_screenshot", description: "Gets a screenshot", parameters: {type: "OBJECT", properties: {}} },
        { name: "get_page_dom", description: "Gets the dom", parameters: {type: "OBJECT", properties: {}} }
      ]
    }]
  };

  const response1 = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload1)
  });
  const json1 = await response1.json();
  const modelParts = json1.candidates[0].content.parts;
  console.log("Model parts:", JSON.stringify(modelParts, null, 2));

  // Now send it back with ONLY ONE response
  const payload2 = {
    contents: [
      { role: "user", parts: [{ text: "Please call get_page_screenshot AND get_page_dom" }] },
      { role: "model", parts: modelParts },
      { role: "user", parts: [ { functionResponse: { name: modelParts.find(p => p.functionCall).functionCall.name, response: { result: "Success" } } } ] }
    ],
    tools: payload1.tools
  };

  const response2 = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload2)
  });
  const json2 = await response2.json();
  console.log("Status:", response2.status);
  console.log("Response:", JSON.stringify(json2, null, 2));
}

run();

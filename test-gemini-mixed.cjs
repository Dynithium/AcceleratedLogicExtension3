const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

async function run() {
  const payload1 = {
    contents: [{ role: "user", parts: [{ text: "Please call get_page_screenshot" }] }],
    tools: [{
      functionDeclarations: [
        { name: "get_page_screenshot", description: "Gets a screenshot", parameters: {type: "OBJECT", properties: {}} }
      ]
    }]
  };

  const response1 = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload1)
  });
  const json1 = await response1.json();
  const modelParts = json1.candidates[0].content.parts;

  // STRIP THOUGHT SIGNATURE
  const strippedParts = modelParts.map(p => {
    if (p.functionCall) {
      return { functionCall: p.functionCall }; // Missing thoughtSignature!
    }
    return p;
  });

  // Now the user sends another message!
  const payload2 = {
    contents: [
      { role: "user", parts: [{ text: "Please call get_page_screenshot" }] },
      { role: "model", parts: strippedParts }, // Old turn, missing signature!
      { role: "user", parts: [ { functionResponse: { name: strippedParts[0].functionCall.name, response: { result: "Success" } } } ] },
      { role: "user", parts: [ { text: "it still doesn't work" } ] } // NEW turn
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

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

async function run() {
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: "hi" }]
      },
      {
        role: "model",
        parts: [{
          thoughtSignature: "test", // Or maybe thought_signature ? Let's try it outside
          functionCall: { name: "get_page_screenshot", args: {} }
        }]
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "get_page_screenshot",
              response: { result: "Success" }
            }
          }
        ]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          { name: "get_page_screenshot", description: "Gets a screenshot", parameters: {type: "OBJECT", properties: {}} }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  console.log(response.status, JSON.stringify(json, null, 2));
}

run();

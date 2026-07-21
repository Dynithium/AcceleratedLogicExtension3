const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

async function run() {
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: "Please call the test tool with some argument." }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          { name: "test_tool", description: "A test tool", parameters: {type: "OBJECT", properties: { arg: {type: "STRING"}}} }
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
  console.log(JSON.stringify(json.candidates[0].content.parts, null, 2));
}

run();

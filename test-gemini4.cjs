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
          thoughtSignature: "EvsCCvgCARFNMg98RZ5qym9W4f4LWOXePIvuIrVIV6IicAOzRAMh1THKVdH1oUAXXu80zRRicWhd5XzrKN3ggRv67+wRWjqGaQaCqDci/PqUvdEXOlciZ1ckZHY/i6noks31RANU8Ma6haZLVCPr+cNGp36xPUJnp2zNlPr/aCodTnELumsv00zXE09XtnN0VhienKR6ZubFFq0kL++sqeV7RSKHWiKM0ZnRz/PixNrh4Xwq0POq+RCosbK746V+PciM0L1v4AG632HxIpAEEZz4KG46PuV+ftG1d6zB6oKkMYf+xD9DbluNuCM5lSEGrAeI3BlaYQh8shxAW61f6Qcnh6F93uvXKboNilLbEDZDXQ9+/IrqFE4yimAGayXEGUD+zEwHh6/LopAqGbQ0U3NqMXnkBwk7XZDSBl5dECk9ZYiKCTY3ZD3CKzu4v/D75i5C8KcxQmfXaeQfFc9iip6OUyCWyibuoXscXu0xi9WMxBg20kcOAIkSKkRT4g==",
          functionCall: { id: "test-id", name: "get_page_screenshot", args: {} }
        }]
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              id: "test-id",
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

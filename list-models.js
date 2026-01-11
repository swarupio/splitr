const { GoogleGenerativeAI } = require("@google/generative-ai");

// ✅ Your Key is already here
const apiKey = "AIzaSyBuOFeGFCwLF5roKJegepRmaFj6jaE6YRc"; 

async function listModels() {
  console.log("🔍 Authenticating with Google...");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.error) {
      console.error("❌ API Error:", data.error.message);
      // This usually means the API is OFF for this specific key/project
      return;
    }

    console.log("\n✅ SUCCESS! Models available:");
    console.log("---------------------------------------------------");
    data.models.forEach(model => {
      if (model.supportedGenerationMethods.includes("generateContent")) {
        console.log(`👉 "${model.name.replace("models/", "")}"`);
      }
    });
    console.log("---------------------------------------------------");

  } catch (error) {
    console.error("❌ Network Error:", error.message);
  }
}

listModels();
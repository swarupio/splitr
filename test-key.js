const { GoogleGenerativeAI } = require("@google/generative-ai");

// PASTE YOUR NEW KEY INSIDE THE QUOTES BELOW 👇
const API_KEY = "AIzaSyBuOFeGFCwLF5roKJegepRmaFj6jaE6YRc"; 


async function testConnection() {
  console.log("🔑 Testing Hardcoded Key:", API_KEY.substring(0, 10) + "...");
  
  const genAI = new GoogleGenerativeAI(API_KEY);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    console.log("✅ Connection Successful! Generating content...");
    
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    console.log("🤖 Response:", response.text());
    
  } catch (error) {
    console.error("\n❌ FAILED:");
    console.error(error.message);
  }
}

testConnection();
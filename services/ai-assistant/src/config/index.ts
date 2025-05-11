export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "ai-assistant",

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/ai-assistant",
  },

  OPENROUTER: {
    API_KEY: process.env.OPENROUTER_API_KEY || "",
    BASE_URL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    MODEL: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
  },
};

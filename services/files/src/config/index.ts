export const CONFIG = {
  PORT: Number(process.env.PORT) || 3005,
  SERVICE_NAME: process.env.SERVICE_NAME || "ai-assistant",

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/ai-assistant",
  },

  STORAGE: {
    ROOT_DIR: process.env.STORAGE_ROOT_DIR || "./storage",
    MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  }
};
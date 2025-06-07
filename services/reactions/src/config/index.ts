export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "reactions",

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/documents",
  },
};

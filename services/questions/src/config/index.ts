export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },
};

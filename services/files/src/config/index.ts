export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },

  STORAGE: {
    ROOT_DIR: String(process.env.STORAGE_ROOT_DIR),
    MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE),
  }
};
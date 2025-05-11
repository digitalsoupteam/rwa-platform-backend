import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CONFIG } from "./config";
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { DaemonsPlugin } from "./plugins/daemons.plugin";
import { ClientsPlugin } from "./plugins/clients.plugin";
import { ServicesPlugin } from "./plugins/services.plugin";

/**
 * Main application entry point
 */
const app = new Elysia()
  // Global error handler
  .onError(ErrorHandlerPlugin)
  
  // Connect plugins
  .use(ClientsPlugin)
  .use(ServicesPlugin)
  .use(DaemonsPlugin)
  
  // Start server
  .listen(CONFIG.PORT, () => {
    logger.info(
      `🦘 Signer Service (${CONFIG.SIGNER.INSTANCE_ID}) ready at http://127.0.0.1:${CONFIG.PORT}`
    );
  });

/**
 * Graceful shutdown setup
 */
const shutdown = async () => {
  logger.info("Shutting down...");

  try {
    await app.stop();
    logger.info("Server stopped");

    logger.info("Shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle termination signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Export app type for testing
export type App = typeof app;
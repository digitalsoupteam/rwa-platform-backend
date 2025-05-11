import { Elysia } from "elysia";
import { AppError } from "./app-errors";
import { logger } from "@shared/monitoring/src/logger";


export const ErrorHandlerPlugin = ({ error, set, request }) => {
  
  if (error instanceof AppError) {
    set.status = error.statusCode;
    
    
    logger.error(`[${error.code}] ${error.message}`, {
      statusCode: error.statusCode,
      path: request.url,
      details: error.details,
      stack: error.stack
    });

    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    };
  }

  
  set.status = 500;

  
  logger.error('Unexpected error:', {
    path: request.url,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  });

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: `${error}`,
    },
  };
};

import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { AuthService } from "../services/auth.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { CONFIG } from "../config";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("authService", {} as AuthService)
  .onStart(async ({ decorator }) => {
    console.log('Initialize services')
    decorator.authService = new AuthService(
      decorator.userRepository,
      CONFIG.JWT.SECRET,
      CONFIG.JWT.ACCESS_TOKEN_EXPIRY as any,
      CONFIG.JWT.REFRESH_TOKEN_EXPIRY as any,
      CONFIG.AUTH.DOMAIN_NAME,
      CONFIG.AUTH.DOMAIN_VERSION
    );
    console.log('authService')
  });

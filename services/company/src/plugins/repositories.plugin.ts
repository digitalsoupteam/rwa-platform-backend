import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { CompanyRepository } from "../repositories/company.repository";
import { MemberRepository } from "../repositories/members.repository";
import { PermissionRepository } from "../repositories/permissions.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("companyRepository", {} as CompanyRepository)
  .decorate("memberRepository", {} as MemberRepository)
  .decorate("permissionRepository", {} as PermissionRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.companyRepository = new CompanyRepository();
      decorator.memberRepository = new MemberRepository();
      decorator.permissionRepository = new PermissionRepository();

      logger.info("Connecting to MongoDB", {
        uri: CONFIG.MONGODB.URI,
      });

      await mongoose.connect(CONFIG.MONGODB.URI);

      logger.info("MongoDB connected successfully");
    }
  )
  .onStop(async () => {
    logger.info("Disconnecting from MongoDB");
    await mongoose.disconnect();
    logger.info("MongoDB disconnected successfully");
  });
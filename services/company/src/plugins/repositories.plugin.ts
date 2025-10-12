import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { CompanyRepository } from "../repositories/company.repository";
import { MemberRepository } from "../repositories/members.repository";
import { PermissionRepository } from "../repositories/permissions.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const companyRepository = withTraceSync(
    'company.init.repositories.company',
    () => new CompanyRepository()
  );

  const memberRepository = withTraceSync(
    'company.init.repositories.member',
    () => new MemberRepository()
  );

  const permissionRepository = withTraceSync(
    'company.init.repositories.permission',
    () => new PermissionRepository()
  );

  await withTraceAsync(
    'company.init.repositories_plugin.mongoose',
    async (ctx) => {
      logger.info("Connecting to MongoDB", { uri: mongoUri });
      mongoose.connection.once('connected', () => {
        logger.info("MongoDB connected successfully");
        ctx.end();
      });
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'company.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("companyRepository", companyRepository)
      .decorate("memberRepository", memberRepository)
      .decorate("permissionRepository", permissionRepository)
      .onStop(async () => {
        await withTraceAsync(
          'company.stop.repositories_plugin',
          async () => {
            logger.info("Disconnecting from MongoDB");
            await mongoose.disconnect();
            logger.info("MongoDB disconnected successfully");
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>
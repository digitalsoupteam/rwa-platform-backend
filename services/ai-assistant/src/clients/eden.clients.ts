import { edenTreaty } from "@elysiajs/eden";
import { CONFIG } from "../config";
import type { App as RwaApp } from "@services/rwa/src";
import type { App as PortfolioApp } from "@services/portfolio/src";

export const rwaClient = edenTreaty<RwaApp>(CONFIG.OTHER_SERVICES.RWA.URL);
export const portfolioClient = edenTreaty<PortfolioApp>(CONFIG.OTHER_SERVICES.PORTFOLIO.URL);

export type RwaClient = typeof rwaClient;
export type PortfolioClient = typeof portfolioClient;
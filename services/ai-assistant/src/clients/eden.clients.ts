import type { App as RwaApp } from "@services/rwa/src";
import type { App as PortfolioApp } from "@services/portfolio/src";
import { createEdenTreatyClient } from "@shared/monitoring/src/eden";

export const createRwaClient = (url: string) => {
    return createEdenTreatyClient<RwaApp>(url)
}

export const createPortfolioClient = (url: string) => {
    return createEdenTreatyClient<PortfolioApp>(url)
}

export type RwaClient = ReturnType<typeof createRwaClient>;
export type PortfolioClient = ReturnType<typeof createPortfolioClient>;

import type { App as SignersManagerApp } from "@services/signers-manager/src";
import { createEdenTreatyClient } from "@shared/monitoring/src/eden";

export const createSignersManagerClient = (url: string) => {
    return createEdenTreatyClient<SignersManagerApp>(url)
}

export type SignersManagerClient = ReturnType<typeof createSignersManagerClient>;
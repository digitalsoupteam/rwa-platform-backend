import { treaty } from '@elysiajs/eden';
import { trace, propagation, context } from '@opentelemetry/api';
import type { Elysia } from 'elysia';


export function createEdenTreatyClient<T extends Elysia<any, any, any, any, any, any, any>>(url: string) {
    return treaty<T>(url, {
        headers(path, options) {
            const headers: Record<string, string> = {};
            propagation.inject(context.active(), headers);
            return headers;
        }
    });
}
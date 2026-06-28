import type { App as RwaApp } from '@services/rwa/src';
import type { App as DocumentsApp } from '@services/documents/src';
import type { App as GalleryApp } from '@services/gallery/src';
import type { App as ReactionsApp } from '@services/reactions/src';
import type { App as QuestionsApp } from '@services/questions/src';
import type { App as PortfolioApp } from '@services/portfolio/src';
import { createEdenTreatyClient } from '@shared/monitoring/src/eden';

export const createRwaClient = (url: string) => createEdenTreatyClient<RwaApp>(url);
export const createDocumentsClient = (url: string) => createEdenTreatyClient<DocumentsApp>(url);
export const createGalleryClient = (url: string) => createEdenTreatyClient<GalleryApp>(url);
export const createReactionsClient = (url: string) => createEdenTreatyClient<ReactionsApp>(url);
export const createQuestionsClient = (url: string) => createEdenTreatyClient<QuestionsApp>(url);
export const createPortfolioClient = (url: string) => createEdenTreatyClient<PortfolioApp>(url);

export type RwaClient = ReturnType<typeof createRwaClient>;
export type DocumentsClient = ReturnType<typeof createDocumentsClient>;
export type GalleryClient = ReturnType<typeof createGalleryClient>;
export type ReactionsClient = ReturnType<typeof createReactionsClient>;
export type QuestionsClient = ReturnType<typeof createQuestionsClient>;
export type PortfolioClient = ReturnType<typeof createPortfolioClient>;

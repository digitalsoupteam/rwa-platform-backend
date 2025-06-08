import type { 
  AiAssistantClient, 
  AuthClient, 
  TestnetFaucetClient, 
  RwaClient, 
  FilesClient, 
  SignersManagerClient,
  DocumentsClient,
  GalleryClient,
  QuestionsClient,
  FaqClient,
  BlogClient,
  CompanyClient,
  PortfolioClient,
  ChartsClient,
  ReactionsClient
} from '../../clients/eden.clients';
import type { createPubSub } from 'graphql-yoga';
import { CacheService } from '../../services/cache.service';
import { OwnershipService } from '../../services/ownership.service';
import { ParentService } from '../../services/parent.service';

export interface User {
  id: string;
  wallet: string;
}

export interface ServiceClients {
  aiAssistantClient: AiAssistantClient;
  authClient: AuthClient;
  testnetFaucetClient: TestnetFaucetClient;
  rwaClient: RwaClient;
  filesClient: FilesClient;
  signersManagerClient: SignersManagerClient;
  documentsClient: DocumentsClient;
  galleryClient: GalleryClient;
  questionsClient: QuestionsClient;
  faqClient: FaqClient;
  blogClient: BlogClient;
  portfolioClient: PortfolioClient;
  companyClient: CompanyClient;
  chartsClient: ChartsClient;
  reactionsClient: ReactionsClient;
}

export interface Services {
  cache: CacheService;
  ownership: OwnershipService;
  parent: ParentService;
}


export type PubSubInstance = ReturnType<typeof createPubSub>;

export interface GraphQLContext {
  clients: ServiceClients;
  services: Services;
  user: User | null;
  token: string | null;
  pubSub: PubSubInstance;
}

export interface RedisEvent {
  type: string;
  payload: any;
  metadata: {
    timestamp: number;
    service: string;
    version: string;
  };
}
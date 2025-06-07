import { mergeResolvers } from '@graphql-tools/merge';
import { authResolvers } from './auth/resolvers';
import { aiAssistantResolvers } from './ai-assistant/resolvers';
import { testnetFaucetResolvers } from './testnet-faucet/resolvers';
import { signersManagerResolvers } from './signers-manager/resolvers';
import { rwaResolvers } from './rwa/resolvers';
import { documentsResolvers } from './documents/resolvers';
import { galleryResolvers } from './gallery/resolvers';
import { faqResolvers } from './faq/resolvers';
import { blogResolvers } from './blog/resolvers';
import { questionsResolvers } from './questions/resolvers';
import { portfolioResolvers } from './portfolio/resolvers';
import { companyResolvers } from './company/resolvers';
import { chartsResolvers } from './charts/resolvers';
import { demoResolvers } from './demo/resolvers';
import { reactionsResolvers } from './reactions/resolvers';


export const resolvers = mergeResolvers([
  authResolvers,
  aiAssistantResolvers,
  testnetFaucetResolvers,
  signersManagerResolvers,
  rwaResolvers,
  documentsResolvers,
  galleryResolvers,
  faqResolvers,
  blogResolvers,
  questionsResolvers,
  companyResolvers,
  portfolioResolvers,
  demoResolvers,
  chartsResolvers,
  reactionsResolvers,
]);

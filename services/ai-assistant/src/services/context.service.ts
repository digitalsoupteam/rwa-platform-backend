import { logger } from "@shared/monitoring/src/logger";
import type { RwaClient, PortfolioClient } from "@services/gateway/src/clients/eden.clients";
import { AssistantContext } from "../models/shared/enums.model";

export class ContextService {
  private readonly INVESTOR_BASE_PROMPT = 
    "You are an AI assistant helping investors understand and navigate RWA investment opportunities.\n" +
    "You can provide information about available pools, analyze investment options, and explain how the platform works.\n" +
    "Always be clear about risks and encourage users to do their own research before investing.";

  private readonly PRODUCT_OWNER_BASE_PROMPT = 
    "You are an AI assistant helping product owners tokenize their real-world assets.\n" +
    "You can explain the tokenization process, help with pool creation, and provide guidance on managing RWA pools.\n" +
    "Focus on compliance, transparency, and best practices for successful asset tokenization.";

  private readonly POOLS_CONTEXT_DESCRIPTION =
    "Investment Pools System Description:\n\n" +
    "A pool is a smart contract that manages the tokenization and trading of real-world assets (RWA). Each pool has:\n\n" +
    "Core Properties:\n" +
    "- Name and unique blockchain address (poolAddress)\n" +
    "- RWA token contract address that represents the underlying asset\n" +
    "- Hold token address used for investments\n" +
    "- Risk score (0-100) calculated based on various factors\n\n" +
    "Investment Parameters:\n" +
    "- Entry fee: Percentage fee for entering the pool\n" +
    "- Exit fee: Percentage fee for exiting the pool\n" +
    "- Expected RWA amount: Target amount of RWA tokens for the pool\n" +
    "- Expected Hold amount: Required amount of Hold tokens\n" +
    "- Reward percentage: Additional rewards for investors\n\n" +
    "Time Periods:\n" +
    "- Entry period: Time window when investors can enter the pool\n" +
    "- Completion period: Deadline for reaching the target amount\n" +
    "- Return schedule: Configured through incoming/outgoing tranches\n\n" +
    "Current State:\n" +
    "- Awaiting RWA amount: Current amount of RWA tokens in the pool\n" +
    "- Target reached status: Whether the expected amount is collected\n" +
    "- Real/Virtual reserves: Current pool liquidity state\n" +
    "- Pause status: Whether operations are temporarily suspended\n\n" +
    "Below are currently active pools that are in their entry period and have collected significant funding:";

  private readonly PORTFOLIO_CONTEXT_DESCRIPTION =
    "Portfolio System Description:\n\n" +
    "Your portfolio tracks all your token balances across different investment pools:\n\n" +
    "Token Balance Properties:\n" +
    "- Pool Address: The smart contract address of the investment pool\n" +
    "- Token Address: The address of the specific token (RWA or Hold)\n" +
    "- Token ID: Unique identifier of the token within the contract\n" +
    "- Balance: Your current token holdings\n" +
    "- Chain ID: The blockchain network where the tokens exist\n\n" +
    "Balance Updates:\n" +
    "- Balances are updated when you perform transactions\n" +
    "- Each update records the block number for tracking\n" +
    "- System maintains history of all balance changes\n\n" +
    "Below are your current non-zero token balances across active pools:";

  constructor(
    private readonly rwaClient: RwaClient,
    private readonly portfolioClient: PortfolioClient,
  ) {}

  async getContextForAssistant(contextPreferences: AssistantContext, userId: string): Promise<string> {
    logger.debug("Getting context for assistant");

    const contextParts = [];

    // Base prompts first
    if (contextPreferences.includes('investor_base')) {
      contextParts.push(this.INVESTOR_BASE_PROMPT);
    }
    
    if (contextPreferences.includes('product_owner_base')) {
      contextParts.push(this.PRODUCT_OWNER_BASE_PROMPT);
    }

    // Then dynamic data
    if (contextPreferences.includes('popular_pools')) {
      const poolsContext = await this.getPopularPoolsContext();
      if (poolsContext) {
        contextParts.push(this.POOLS_CONTEXT_DESCRIPTION + "\n\n" + poolsContext);
      }
    }

    if (contextPreferences.includes('user_portfolio')) {
      const portfolioContext = await this.getUserPortfolioContext(userId);
      if (portfolioContext) {
        contextParts.push(this.PORTFOLIO_CONTEXT_DESCRIPTION + "\n\n" + portfolioContext);
      }
    }

    return contextParts.join('\n\n');
  }

  private async getPopularPoolsContext(): Promise<string | null> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      const response = await this.rwaClient.getPools.post({
        filter: {
          poolAddress: { $ne: null },
          entryPeriodStart: { $lte: now },
          entryPeriodExpired: { $gt: now },
          targetReached: false,
          awaitingRwaAmount: { $gt: "expectedRwaAmount/2" }
        },
        limit: 100
      });

      if (response.error) {
        logger.error("Failed to get popular pools", { error: response.error });
        return null;
      }

      if (!response.data?.length) {
        return null;
      }

      const header = "Currently popular investment pools:";
      const poolsList = response.data.map(pool => {
        const progress = (Number(pool.awaitingRwaAmount) / Number(pool.expectedRwaAmount) * 100).toFixed(1);
        return `- ${pool.name} (${pool.poolAddress}): ${progress}% funded (${pool.awaitingRwaAmount}/${pool.expectedRwaAmount} tokens)`;
      });

      return [header, ...poolsList].join('\n');
    } catch (error) {
      logger.error("Error getting popular pools context", { error });
      return null;
    }
  }

  private async getUserPortfolioContext(userId: string): Promise<string | null> {
    try {
      // Получаем балансы > 0
      const balancesResponse = await this.portfolioClient.getBalances.post({ 
        filter: {
          owner: userId,
          balance: { $gt: 0 }
        }
      });

      if (balancesResponse.error) {
        logger.error("Failed to get user balances", { error: balancesResponse.error });
        return null;
      }

      if (!balancesResponse.data?.length) {
        return null;
      }

      // Получаем информацию о пулах
      const poolIds = balancesResponse.data.map(b => b.poolAddress);
      const poolsResponse = await this.rwaClient.getPools.post({
        filter: {
          id: { $in: poolIds }
        }
      });

      if (poolsResponse.error) {
        logger.error("Failed to get pools info", { error: poolsResponse.error });
        return null;
      }

      if (!poolsResponse.data?.length) {
        return null;
      }

      const header = "Your current investments:";
      const investmentsList = balancesResponse.data.map(balance => {
        const pool = poolsResponse.data.find(p => p.id === balance.poolAddress);
        if (!pool) return `- Unknown Pool: ${balance.balance} tokens`;
        return `- ${pool.name}: ${balance.balance} tokens`;
      });

      return [header, ...investmentsList].join('\n');
    } catch (error) {
      logger.error("Error getting user portfolio context", { error });
      return null;
    }
  }
}
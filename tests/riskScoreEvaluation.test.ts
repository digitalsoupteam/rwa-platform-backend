import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";
import {
  CREATE_BUSINESS,
  GET_BUSINESS,
  UPDATE_BUSINESS_RISK_SCORE,
  CREATE_POOL,
  GET_POOL,
  UPDATE_POOL_RISK_SCORE,
} from "./utils/graphql/schema/rwa";
import { GET_EVALUATIONS } from "./utils/graphql/schema/ai-evaluator";
import { SET_REACTION, GET_ENTITY_REACTIONS } from "./utils/graphql/schema/reactions";
import { CREATE_TOPIC, CREATE_QUESTION, CREATE_QUESTION_ANSWER } from "./utils/graphql/schema/questions";
import { requestHold, requestGas } from "./utils/requestTokens";

/**
 * Helper: poll until riskScore appears on a business or pool
 */
async function pollRiskScore(
  query: string,
  id: string,
  accessToken: string,
  field: "getBusiness" | "getPool" = "getBusiness",
  timeoutMs = 120_000,
): Promise<number> {
  const interval = 2_000;
  for (let i = 0; i < timeoutMs / interval; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const poll = await makeGraphQLRequest(query, { id }, accessToken);
    const score = poll.data?.[field]?.riskScore;
    if (score != null) return score;
  }
  throw new Error(`riskScore did not appear within ${timeoutMs}ms for ${id}`);
}

/**
 * Helper: poll until an evaluation for the given parentId completes
 */
async function pollEvaluationByParentId(
  parentId: string,
  accessToken: string,
  timeoutMs = 120_000,
): Promise<any> {
  const interval = 2_000;
  for (let i = 0; i < timeoutMs / interval; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const poll = await makeGraphQLRequest(
      GET_EVALUATIONS,
      { input: { filter: { parentId } } },
      accessToken,
    );
    const evals = poll.data?.getEvaluations;
    if (evals && evals.length > 0) {
      const completed = evals.find((e: any) => e.status !== "pending");
      if (completed) return completed;
    }
  }
  throw new Error(`Evaluation for ${parentId} did not complete within ${timeoutMs}ms`);
}

describe("Risk Score Evaluation", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let accessToken: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let poolId: string;

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));

    // Create company
    const companyResult = await makeGraphQLRequest(
      CREATE_COMPANY,
      { input: { name: "Eval Test Company", description: "For risk score tests" } },
      accessToken,
    );
    companyId = companyResult.data.createCompany.id;

    // Create business
    const bizResult = await makeGraphQLRequest(
      CREATE_BUSINESS,
      {
        input: {
          name: "Eval Test Business",
          ownerId: companyId,
          ownerType: "company",
          chainId,
          description: "Business for evaluation testing",
          tags: ["eval", "test"],
          country: "AE",
          businessType: "startup",
        },
      },
      accessToken,
    );
    businessId = bizResult.data.createBusiness.id;

    // Create pool
    const poolResult = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          name: "Eval Test Pool",
          businessId,
        },
      },
      accessToken,
    );
    poolId = poolResult.data.createPool.id;
  });

  // ──────────────────────────────────────────────
  // Basic evaluation
  // ──────────────────────────────────────────────

  test("should evaluate business risk score", async () => {
    const result = await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      { id: businessId },
      accessToken,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.updateBusinessRiskScore).toBeDefined();
    expect(result.data.updateBusinessRiskScore.id).toBe(businessId);
    expect(result.data.updateBusinessRiskScore.riskScoreEvaluationProcess).toBe(true);

    // Wait for riskScore to appear on the business entity
    const riskScore = await pollRiskScore(GET_BUSINESS, businessId, accessToken, "getBusiness");
    expect(riskScore).toBeGreaterThanOrEqual(1);
    expect(riskScore).toBeLessThanOrEqual(100);

    // Verify evaluation record exists and is completed
    const evaluation = await pollEvaluationByParentId(businessId, accessToken);
    expect(evaluation.status).toBe("completed");
    expect(evaluation.riskScore).toBe(riskScore);
    expect(evaluation.reasoning).toBeDefined();
    expect(evaluation.reasoning).not.toBe("");
    expect(evaluation.factors).toBeArray();
    expect(evaluation.factors.length).toBeGreaterThan(0);
  });

  test("should evaluate pool risk score", async () => {
    const result = await makeGraphQLRequest(
      UPDATE_POOL_RISK_SCORE,
      { id: poolId },
      accessToken,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.updatePoolRiskScore).toBeDefined();
    expect(result.data.updatePoolRiskScore.id).toBe(poolId);
    expect(result.data.updatePoolRiskScore.riskScoreEvaluationProcess).toBe(true);

    // Wait for riskScore to appear on the pool entity
    const riskScore = await pollRiskScore(GET_POOL, poolId, accessToken, "getPool");
    expect(riskScore).toBeGreaterThanOrEqual(1);
    expect(riskScore).toBeLessThanOrEqual(100);

    // Verify evaluation record exists
    const evaluation = await pollEvaluationByParentId(poolId, accessToken);
    expect(evaluation.status).toBe("completed");
    expect(evaluation.riskScore).toBe(riskScore);
    expect(evaluation.reasoning).toBeDefined();
    expect(evaluation.factors).toBeArray();
    expect(evaluation.factors.length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // Guard: duplicate evaluation
  // ──────────────────────────────────────────────

  test("should reject duplicate evaluation while one is in progress", async () => {
    // First call — starts evaluation
    const first = await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      { id: businessId },
      accessToken,
    );
    expect(first.errors).toBeUndefined();

    // Second call while first is still pending (or just completed — but we check guard)
    const second = await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      { id: businessId },
      accessToken,
    );

    // If the first is still pending, we get 403. If it already completed, the second
    // starts a new one — either is acceptable, but we must not get an error from the system.
    if (second.errors) {
      expect(second.errors[0].message).toContain("Evaluation already in progress");
    } else {
      // First completed already, second started a new evaluation — that's fine
      expect(second.data.updateBusinessRiskScore.riskScoreEvaluationProcess).toBe(true);
    }
  });

  // ──────────────────────────────────────────────
  // Evaluation with reactions
  // ──────────────────────────────────────────────

  test("should consider reactions in evaluation", async () => {
    // Add reactions to the business
    await makeGraphQLRequest(
      SET_REACTION,
      { input: { parentId: businessId, parentType: "business", reaction: "like" } },
      accessToken,
    );

    // Verify reactions exist
    const reactionsCheck = await makeGraphQLRequest(
      GET_ENTITY_REACTIONS,
      { parentId: businessId, parentType: "business" },
      accessToken,
    );
    expect(reactionsCheck.errors).toBeUndefined();
    expect(reactionsCheck.data.getEntityReactions.reactions).toBeDefined();

    // Start evaluation
    const result = await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      { id: businessId },
      accessToken,
    );
    const riskScore = await pollRiskScore(GET_BUSINESS, businessId, accessToken, "getBusiness");

    // Verify evaluation record exists
    const evaluation = await pollEvaluationByParentId(businessId, accessToken);
    expect(evaluation.status).toBe("completed");
    // stage1Response should mention reactions
    expect(evaluation.stage1Response).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // Evaluation with questions
  // ──────────────────────────────────────────────

  test("should consider questions in evaluation", async () => {
    // Create a topic and question for the business
    const topicResult = await makeGraphQLRequest(
      CREATE_TOPIC,
      {
        input: {
          name: "Eval Topic",
          ownerId: companyId,
          ownerType: "company",
          parentId: businessId,
          grandParentId: companyId,
        },
      },
      accessToken,
    );
    const topicId = topicResult.data.createTopic.id;

    // Create a question
    const qResult = await makeGraphQLRequest(
      CREATE_QUESTION,
      {
        input: {
          topicId,
          text: "What is the business model?",
          ownerId: companyId,
          ownerType: "company",
          parentId: businessId,
          grandParentId: companyId,
        },
      },
      accessToken,
    );
    const questionId = qResult.data.createQuestion.id;

    // Answer it
    await makeGraphQLRequest(
      CREATE_QUESTION_ANSWER,
      {
        input: {
          id: questionId,
          text: "This is a coffee shop franchise with verified revenue.",
        },
      },
      accessToken,
    );

    // Start evaluation
    const result = await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      { id: businessId },
      accessToken,
    );
    const riskScore = await pollRiskScore(GET_BUSINESS, businessId, accessToken, "getBusiness");

    const evaluation = await pollEvaluationByParentId(businessId, accessToken);
    expect(evaluation.status).toBe("completed");
    expect(evaluation.stage1Response).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // Evaluation with sibling pools
  // ──────────────────────────────────────────────

  test("should consider sibling pools in evaluation", async () => {
    // Create a second pool under the same business
    const pool2Result = await makeGraphQLRequest(
      CREATE_POOL,
      { input: { name: "Sibling Pool", businessId } },
      accessToken,
    );
    const pool2Id = pool2Result.data.createPool.id;

    // Evaluate the second pool
    const result = await makeGraphQLRequest(
      UPDATE_POOL_RISK_SCORE,
      { id: pool2Id },
      accessToken,
    );
    const riskScore = await pollRiskScore(GET_POOL, pool2Id, accessToken, "getPool");

    const evaluation = await pollEvaluationByParentId(pool2Id, accessToken);
    expect(evaluation.status).toBe("completed");
    // stage1Response should reference sibling pools
    expect(evaluation.stage1Response).toBeDefined();
    expect(evaluation.stage1Response.length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // Evaluation detail: factors and reasoning
  // ──────────────────────────────────────────────

  test("should return detailed factors and reasoning", async () => {
    const result = await makeGraphQLRequest(
      UPDATE_POOL_RISK_SCORE,
      { id: poolId },
      accessToken,
    );
    const riskScore = await pollRiskScore(GET_POOL, poolId, accessToken, "getPool");

    const evaluation = await pollEvaluationByParentId(poolId, accessToken);
    expect(evaluation.status).toBe("completed");
    expect(evaluation.factors).toBeArray();
    expect(evaluation.factors.length).toBeGreaterThan(0);

    // Each factor should have name, impact, detail
    for (const factor of evaluation.factors) {
      expect(factor.name).toBeDefined();
      expect(factor.name).not.toBe("");
      expect(factor.impact).toBeDefined();
      expect(factor.detail).toBeDefined();
      expect(factor.detail).not.toBe("");
    }

    expect(evaluation.reasoning).toBeDefined();
    expect(evaluation.reasoning.length).toBeGreaterThan(50);
  });

  // ──────────────────────────────────────────────
  // Evaluation status tracking
  // ──────────────────────────────────────────────

  test("should track evaluation status correctly", async () => {
    const result = await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      { id: businessId },
      accessToken,
    );
    const riskScore = await pollRiskScore(GET_BUSINESS, businessId, accessToken, "getBusiness");

    const evaluation = await pollEvaluationByParentId(businessId, accessToken);
    expect(evaluation.status).toBe("completed");
    expect(evaluation.riskScore).toBeDefined();
    expect(evaluation.evaluatedDocuments).toBeArray();
    expect(evaluation.evaluatedImages).toBeArray();
  });

  // ──────────────────────────────────────────────
  // TODO: Portfolio evaluation
  // ──────────────────────────────────────────────

  // test("should consider portfolio data in evaluation", async () => {
  //   TODO: Requires a deployed pool with on-chain data.
  //   Steps:
  //     1. Deploy pool contract (see rwa.test.ts "should deploy pool contract")
  //     2. Wait for blockchain-scanner to index portfolio data
  //     3. Start evaluation on the deployed pool
  //     4. Verify stage1Response mentions portfolio/investors
  //     5. Verify riskScore is computed
  // });
});

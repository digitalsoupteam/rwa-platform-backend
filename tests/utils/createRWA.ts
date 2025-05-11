import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS } from "./config";
import { makeGraphQLRequest } from "./graphql/makeGraphQLRequest";
import {
  CREATE_BUSINESS,
  GET_BUSINESS,
  REQUEST_APPROVAL_SIGNATURES,
  UPDATE_BUSINESS,
  UPDATE_BUSINESS_RISK_SCORE,
} from "./graphql/schema/business";
import { ethers } from "ethers";
import type { Signer } from "ethers";

export async function createRwa(
  signer: Signer,
  accessToken: string,
  chainId: string,
  name: string,
  description: string,
  tags: string[]
) {
  const createBusiness = await makeGraphQLRequest(
    CREATE_BUSINESS,
    {
      input: {
        name,
        chainId,
      },
    },
    accessToken
  );

  if (createBusiness.errors)
    throw `createRwa createBusiness error ${createBusiness.errors}`;

  const businessId = createBusiness.data.createBusiness.id;

  const updateBusiness = await makeGraphQLRequest(
    UPDATE_BUSINESS,
    {
      input: {
        id: businessId,
        description,
        tags,
      },
    },
    accessToken
  );

  if (updateBusiness.errors)
    throw `createRwa updateBusiness error ${updateBusiness.errors}`;

  const updateRiskScore = await makeGraphQLRequest(
    UPDATE_BUSINESS_RISK_SCORE,
    {
      input: {
        id: businessId,
      },
    },
    accessToken
  );

  if (updateRiskScore.errors)
    throw `createRwa updateRiskScore error ${updateRiskScore.errors}`;

  const requestApprovalSignatures = await makeGraphQLRequest(
    REQUEST_APPROVAL_SIGNATURES,
    {
      input: {
        id: businessId,
      },
    },
    accessToken
  );

  if (requestApprovalSignatures.errors)
    throw `createRwa requestApprovalSignatures error ${requestApprovalSignatures.errors}`;

  await new Promise((resolve) => setTimeout(resolve, 10000));

  const getBusiness = await makeGraphQLRequest(
    GET_BUSINESS,
    {
      input: {
        id: businessId,
      },
    },
    accessToken
  );

  if (getBusiness.errors)
    throw `createRwa getBusiness error ${getBusiness.errors}`;

  const signatures = getBusiness.data.getBusiness.approvalSignatures;
  const expired = getBusiness.data.getBusiness.approvalSignaturesExpired;
  const signers = signatures.map((sig: any) => ethers.getAddress(sig.signer));
  const signatureValues = signatures.map((sig: any) => sig.signature);

  const holdToken = new ethers.Contract(
    HOLD_TOKEN_ADDRESS,
    ["function approve(address spender, uint256 amount) public returns (bool)"],
    signer
  );

  const approveTx = await holdToken.approve(FACTORY_ADDRESS, ethers.MaxUint256);
  await approveTx.wait(1);

  const factory = new ethers.Contract(
    FACTORY_ADDRESS,
    [
      "function deployRWA(string calldata entityId, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
    ],
    signer
  );

  const deployTx = await factory.deployRWA(
    businessId,
    signers,
    signatureValues,
    expired,
    {
      gasLimit: 600000,
      gasPrice: 1000000000,
    }
  );
  await deployTx.wait(20);

  const deployedBusiness = await makeGraphQLRequest(
    GET_BUSINESS,
    {
      input: {
        id: businessId,
      },
    },
    accessToken
  );

  return {
    businessId: businessId as string,
    tokenAddress: deployedBusiness.data.getBusiness.tokenAddress as string
  };
}

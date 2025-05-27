import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { GET_POOL } from "../utils/graphql/schema/rwa";
import { requestHold, requestGas } from "../utils/requestTokens";
import { readFile } from "fs/promises";
import { join } from "path";
import { authenticate } from "../utils/authenticate";

interface PoolData {
  poolId: string;
  businessId: string;
  companyId: string;
  poolAddress: string;
  rwaAddress: string;
  ownerWallet: string;
  ownerPrivateKey: string;
  accessToken: string;
  chainId: string;
  poolData: any;
}

describe("RWA Pool Trading", () => {
  let provider: JsonRpcProvider;
  let poolWallet: Wallet;
  let userWallet: Wallet;
  let poolData: PoolData;
  let userAccessToken: string;

  
  const poolDataPath = join(__dirname, "pool-data.json");

  beforeAll(async () => {
    
    const rawData = await readFile(poolDataPath, 'utf-8');
    poolData = JSON.parse(rawData);

    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    poolWallet = new Wallet(poolData.ownerPrivateKey).connect(provider);
    userWallet = ethers.Wallet.createRandom().connect(provider) as any;

    
    ({ accessToken: userAccessToken } = await authenticate(userWallet));

    
    await requestHold(userAccessToken, 10000);
    await requestGas(userAccessToken, 0.01);
    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  test("should perform mint and burn operations", async () => {
    const poolContract = new ethers.Contract(
      poolData.poolAddress,
      [
        "function estimateMint(uint256 rwaAmount, bool allowPartial) public view returns (uint256 holdAmountWithFee, uint256 fee, uint256 actualRwaAmount)",
        "function mint(uint256 rwaAmount, uint256 maxHoldAmount, uint256 validUntil, bool allowPartial) external",
        "function estimateBurn(uint256 rwaAmount) public view returns (uint256 holdAmountWithoutFee, uint256 holdFee, uint256 bonusAmountWithoutFee, uint256 bonusFee)",
        "function burn(uint256 rwaAmount, uint256 minHoldAmount, uint256 minBonusAmount, uint256 validUntil) external",
        "function holdToken() public view returns (address)",
        "function awaitingRwaAmount() public view returns (uint256)",
        "function realHoldReserve() public view returns (uint256)",
        "function virtualHoldReserve() public view returns (uint256)",
        "function virtualRwaReserve() public view returns (uint256)",
      ],
      userWallet
    );

    // Get HOLD token address and approve spending
    const holdTokenAddress = await poolContract.holdToken();
    const holdToken = new ethers.Contract(
      holdTokenAddress,
      [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function balanceOf(address account) public view returns (uint256)",
      ],
      userWallet
    );

    const approveTx = await holdToken.approve(
      poolData.poolAddress,
      ethers.MaxUint256
    );
    await approveTx.wait();

  
    for(let i = 0; i < 10000; i++) {

    // Perform mint operation
    const rwaAmount = "1000";
    const [holdAmountWithFee, fee, actualRwaAmount] = await poolContract.estimateMint(rwaAmount, true);
    console.log("Mint estimation:", {
      holdAmountWithFee: holdAmountWithFee.toString(),
      fee: fee.toString(),
      actualRwaAmount: actualRwaAmount.toString()
    });
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const mintTx = await poolContract.mint(
      rwaAmount,
      holdAmountWithFee,
      validUntil,
      true,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await mintTx.wait(1);

    await new Promise(resolve => setTimeout(resolve, 25000));
    }
  });
});
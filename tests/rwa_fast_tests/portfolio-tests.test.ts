import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { GET_BALANCES } from "../utils/graphql/schema/portfolio";
import { readFile } from "fs/promises";
import { join } from "path";
import { authenticate } from "../utils/authenticate";
import { requestGas, requestHold } from "../utils/requestTokens";

// Contract ABIs
const POOL_ABI = [
  "function estimateMint(uint256 rwaAmount, bool allowPartial) public view returns (uint256 holdAmountWithFee, uint256 fee, uint256 actualRwaAmount)",
  "function mint(uint256 rwaAmount, uint256 maxHoldAmount, uint256 validUntil, bool allowPartial) external",
  "function estimateBurn(uint256 rwaAmount) public view returns (uint256 holdAmountWithoutFee, uint256 holdFee, uint256 bonusAmountWithoutFee, uint256 bonusFee)",
  "function burn(uint256 rwaAmount, uint256 minHoldAmount, uint256 minBonusAmount, uint256 validUntil) external",
  "function tokenId() external view returns (uint256)",
  "function rwaToken() external view returns (address)",
  "function holdToken() public view returns (address)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

const ERC1155_ABI = [
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) external view returns (bool)",
];

interface PortfolioData {
  chainId: string;
  business1Id: string;
  business2Id: string;
  business1Address: string;
  business2Address: string;
  pool1Id: string;
  pool2Id: string;
  pool3Id: string;
  pool1Address: string;
  pool2Address: string;
  pool3Address: string;
  ownerWallet: string;
  ownerPrivateKey: string;
  accessToken: string;
  business1Data: any;
  business2Data: any;
  pool1Data: any;
  pool2Data: any;
  pool3Data: any;
}

describe("Portfolio Tests", () => {
  let provider: JsonRpcProvider;
  let wallet: Wallet;
  let portfolioData: PortfolioData;
  let accessToken: string;
  let userId: string;

  const portfolioDataPath = join(__dirname, "portfolio-data.json");

  beforeAll(async () => {
    const rawData = await readFile(portfolioDataPath, 'utf-8');
    portfolioData = JSON.parse(rawData);

    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = new Wallet(portfolioData.ownerPrivateKey).connect(provider);

    ({ accessToken, userId } = await authenticate(wallet));


    await requestHold(accessToken, 10000);
    await requestGas(accessToken, 0.003);
  });

  test("should mint tokens from first pool and check balance", async () => {
    // Create pool contract instance
    const pool1Contract = new ethers.Contract(portfolioData.pool1Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const rwaAddress = await pool1Contract.rwaToken();

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool1Address,
          }
        }
      },
      accessToken
    );
    const initialBalance = initialBalanceResult.data.getBalances[0]?.balance || 0;

    // Approve HOLD tokens for pool
    const approveTx = await holdToken.approve(portfolioData.pool1Address, ethers.MaxUint256);
    await approveTx.wait(1)

    // Estimate mint for 1000 RWA
    const rwaAmount = "1000";
    const [holdAmountWithFee] = await pool1Contract.estimateMint(rwaAmount, true);
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Add 10% slippage tolerance
    const maxHoldAmount = BigInt(holdAmountWithFee) * BigInt(110) / BigInt(100);

    // Mint tokens
    const mintTx = await pool1Contract.mint(
      rwaAmount,
      maxHoldAmount,
      validUntil,
      true,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await mintTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool1Address,
          }
        }
      },
      accessToken
    );

    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balance change
    expect(finalApiBalance).toBe(initialBalance + Number(rwaAmount));
  });

  test("should mint tokens from second pool and check balance", async () => {
    // Create pool contract instance
    const pool2Contract = new ethers.Contract(portfolioData.pool2Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const tokenId = await pool2Contract.tokenId();
    const rwaAddress = await pool2Contract.rwaToken();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool2Address,
          }
        }
      },
      accessToken
    );
    const initialBalance = initialBalanceResult.data.getBalances[0]?.balance || 0;

    // Get initial balance from contract
    const initialContractBalance = await rwaToken.balanceOf(wallet.address, tokenId);

    // Verify initial balances match
    expect(initialBalance).toBe(Number(initialContractBalance));

    // Approve HOLD tokens for pool
    const approveTx = await holdToken.approve(portfolioData.pool2Address, ethers.MaxUint256);
    await approveTx.wait(1)

    // Estimate mint for 1500 RWA
    const rwaAmount = "1500";
    const [holdAmountWithFee] = await pool2Contract.estimateMint(rwaAmount, true);
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Add 10% slippage tolerance
    const maxHoldAmount = BigInt(holdAmountWithFee) * BigInt(110) / BigInt(100);

    // Mint tokens
    const mintTx = await pool2Contract.mint(
      rwaAmount,
      maxHoldAmount,
      validUntil,
      true,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await mintTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool2Address,
          }
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balance change
    expect(finalApiBalance).toBe(initialBalance + Number(rwaAmount));
  });

  test("should mint tokens from third pool and check balance", async () => {
    // Create pool contract instance
    const pool3Contract = new ethers.Contract(portfolioData.pool3Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const rwaAddress = await pool3Contract.rwaToken();

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool3Address,
          }
        }
      },
      accessToken
    );
    const initialBalance = initialBalanceResult.data.getBalances[0]?.balance || 0;

    // Approve HOLD tokens for pool
    const approveTx = await holdToken.approve(portfolioData.pool3Address, ethers.MaxUint256);
    await approveTx.wait(1)

    // Estimate mint for 2000 RWA
    const rwaAmount = "2000";
    const [holdAmountWithFee] = await pool3Contract.estimateMint(rwaAmount, true);
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Add 10% slippage tolerance
    const maxHoldAmount = BigInt(holdAmountWithFee) * BigInt(110) / BigInt(100);

    // Mint tokens
    const mintTx = await pool3Contract.mint(
      rwaAmount,
      maxHoldAmount,
      validUntil,
      true,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await mintTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool3Address,
          }
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balance change
    expect(finalApiBalance).toBe(initialBalance + Number(rwaAmount));
  });

  test("should burn tokens back to first pool and check balance decrease", async () => {
    // Create pool contract instance
    const pool1Contract = new ethers.Contract(portfolioData.pool1Address, POOL_ABI, wallet);

    // Get token info
    const tokenId = await pool1Contract.tokenId();
    const rwaAddress = await pool1Contract.rwaToken();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool1Address,
          }
        }
      },
      accessToken
    );
    console.log(JSON.stringify(initialBalanceResult))
    const initialApiBalance = initialBalanceResult.data.getBalances[0]?.balance || 0;

    // Estimate burn for all tokens
    const rwaAmount = initialApiBalance;
    const [holdAmountWithoutFee, , bonusAmountWithoutFee] = await pool1Contract.estimateBurn(rwaAmount);
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Add 10% slippage tolerance
    const minHoldAmount = BigInt(holdAmountWithoutFee) * BigInt(90) / BigInt(100);
    const minBonusAmount = BigInt(bonusAmountWithoutFee) * BigInt(90) / BigInt(100);

    // Burn tokens
    const burnTx = await pool1Contract.burn(
      rwaAmount,
      minHoldAmount,
      minBonusAmount,
      validUntil,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await burnTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: wallet.address,
            pool: portfolioData.pool1Address,
          }
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balance change
    expect(finalApiBalance).toBe(initialApiBalance - Number(rwaAmount));
  });

  test("should transfer tokens between wallets and check balances", async () => {
    // Create second wallet for testing
    const wallet2 = ethers.Wallet.createRandom().connect(provider);

    // Create pool contract instance and get token info
    const pool1Contract = new ethers.Contract(portfolioData.pool1Address, POOL_ABI, wallet);
    const tokenId = await pool1Contract.tokenId();
    const rwaAddress = await pool1Contract.rwaToken();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balances from contract
    const initialContractBalance1 = await rwaToken.balanceOf(wallet.address, tokenId);
    const initialContractBalance2 = await rwaToken.balanceOf(wallet2.address, tokenId);

    // Get initial balances from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: { $in: [wallet.address, wallet2.address] },
            pool: portfolioData.pool1Address,
          }
        }
      },
      accessToken
    );
    const initialApiBalance1 = initialBalanceResult.data.getBalances[0]?.balance || 0;
    const initialApiBalance2 = initialBalanceResult.data.getBalances[1]?.balance || 0;

    // Transfer half of tokens to wallet2
    const transferAmount = initialContractBalance1 / BigInt(2);
    const transferTx = await rwaToken.safeTransferFrom(
      wallet.address,
      wallet2.address,
      tokenId,
      transferAmount,
      "0x",
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await transferTx.wait(20)

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balances from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          filter: {
            owner: { $in: [wallet.address, wallet2.address] },
            pool: portfolioData.pool1Address,
          }
        }
      },
      accessToken
    );
    console.log(JSON.stringify(finalBalanceResult))

    const finalApiBalance1 = finalBalanceResult.data.getBalances[0].balance;
    const finalApiBalance2 = finalBalanceResult.data.getBalances[1].balance;

    // Verify balance changes
    expect(finalApiBalance1).toBe(initialApiBalance1 - Number(transferAmount));
    expect(finalApiBalance2).toBe(initialApiBalance2 + Number(transferAmount));

    // Total amount should remain the same
    expect(finalApiBalance1 + finalApiBalance2).toBe(initialApiBalance1 + initialApiBalance2);
  });
});

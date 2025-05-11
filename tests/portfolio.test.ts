import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_BUSINESS,
  UPDATE_BUSINESS,
  UPDATE_BUSINESS_RISK_SCORE,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
  GET_BUSINESS,
  CREATE_POOL,
  UPDATE_POOL,
  UPDATE_POOL_RISK_SCORE,
  REQUEST_POOL_APPROVAL_SIGNATURES,
  GET_POOL,
} from "./utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "./utils/graphql/schema/signers-manager";
import { requestGas, requestHold } from "./utils/requestTokens";
import {
  GET_BALANCES,
  GET_TRANSACTIONS,
} from "./utils/graphql/schema/portfolio";

// Contract ABIs
const FACTORY_ABI = [
  "function deployRWA(string calldata entityId, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
  "function deployPool(string memory entityId, address rwa, uint256 targetAmount, uint256 profitPercent, uint256 investmentDuration, uint256 realiseDuration, bool speculationsEnabled, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

const POOL_ABI = [
  "function swapExactInput(uint256 amountIn, uint256 minAmountOut, bool isRWAIn) external returns (uint256)",
  "function getAmountOut(uint256 amountIn, bool isRWAIn) external view returns (uint256)",
  "function tokenId() external view returns (uint256)",
  "function rwa() external view returns (address)",
];

const ERC1155_ABI = [
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) external view returns (bool)",
];

describe("Portfolio Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let accessToken: string;
  let userId: string;
  
  // Business addresses
  let business1Id: string;
  let business2Id: string;
  let business1Address: string;
  let business2Address: string;
  
  // Pool addresses
  let pool1Id: string;
  let pool2Id: string;
  let pool3Id: string;
  let pool1Address: string;
  let pool2Address: string;
  let pool3Address: string;


  // test('1', async () => {
  //   // Get pool addresses

  //   const balanceResult = await makeGraphQLRequest(
  //     GET_BALANCES,
  //     {
  //       input: {
  //         owners: ['0xFAD47F0BaD95314CbE001A4364c626Da2100b2e2'],
  //         tokenAddresses: ['0x8dE483b603De0355cd7DeAcABb9253fCD7a7CaC3'],
  //       }
  //     },
  //     accessToken
  //   );

  //   console.log(balanceResult.data.getBalances)
  // })

  // return
  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
// console.log(wallet.address)
// wallet = new ethers.Wallet('0x9ed93b23b219cfa03dbe79991933a847cbfac1802cda4d5cee59f4ac82650562').connect(provider) as any
//     // accessToken ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODA5MWY2NWMxMjBjZDlmZTIzZDNjMjIiLCJ3YWxsZXQiOiIweEZBRDQ3RjBCYUQ5NTMxNENiRTAwMUE0MzY0YzYyNkRhMjEwMGIyZTIiLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiYjRlOTY1NTIzNmEyN2E5OTk0NzczNWIwMGFiOTE1NTgiLCJpYXQiOjE3NDU0MjgzMjUsImV4cCI6MTc0NTQyOTIyNX0.u_o0LIVbtkd7H7oc8AkebOdeXQ3SSn6O5eQAOtC7mvY'
//     // userId =      '68091c68c120cd9fe23d3c21'
//     business1Id = '68093260c4e5f39cb27cdabe'
//     business2Id = '6809329ac4e5f39cb27cdaca'
//     business1Address = '0x8aF7c1855B7CC8eC90db939813478d944E081BB4'
//     business2Address = '0x1b51DD55B0f581037902F09b923C410c8289dc1e'
//     pool1Id = '680932d1c4e5f39cb27cdad7'
//     pool2Id = '68093308c4e5f39cb27cdae4'
//     pool3Id = '68093335c4e5f39cb27cdaf1'
//     pool1Address = '0xA2B51D81C0b45eE61Be84Cc42Aee9a3F74Bbe51C'
//     pool2Address = '0xfc2902A9CA72c46693f54935AAD1b76550902F39'
//     pool3Address = '0x00CA74D6D5C1528D7C77282991B9D64AfF6884fC';

    ({ accessToken, userId } = await authenticate(wallet));

    // Request initial tokens
    await requestHold(accessToken, 2000);
    await requestGas(accessToken, 0.01);
    
    // Wait for transactions to be mined
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // return
    // Create first business
    const business1Result = await makeGraphQLRequest(
      CREATE_BUSINESS,
      {
        input: {
          name: "First Test Business",
          chainId,
        },
      },
      accessToken
    );
    business1Id = business1Result.data.createBusiness.id;

    // Update first business data
    await makeGraphQLRequest(
      UPDATE_BUSINESS,
      {
        input: {
          id: business1Id,
          name: "First Test Business",
          description: "Business for portfolio testing",
          tags: ["test", "portfolio"],
          image: "https://example.com/image1.png",
        },
      },
      accessToken
    );

    // Update first business risk score
    await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      {
        input: {
          id: business1Id,
        },
      },
      accessToken
    );

    // Request signatures for first business
    const signatures1Result = await makeGraphQLRequest(
      REQUEST_BUSINESS_APPROVAL_SIGNATURES,
      {
        input: {
          id: business1Id,
          userWallet: wallet.address,
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get signatures for first business
    const task1Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: signatures1Result.data.requestBusinessApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const signatures1 = task1Result.data.getSignatureTask.signatures;
    const signers1 = signatures1.map((sig: any) => ethers.getAddress(sig.signer));
    const signatureValues1 = signatures1.map((sig: any) => sig.signature);
    const expired1 = task1Result.data.getSignatureTask.expired;

    // Deploy first business contract
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    await holdToken.approve(FACTORY_ADDRESS, ethers.MaxUint256);
    const deploy1Tx = await factory.deployRWA(
      business1Id,
      signers1,
      signatureValues1,
      expired1,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deploy1Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get first business address
    const business1Data = await makeGraphQLRequest(
      GET_BUSINESS,
      {
        input: {
          id: business1Id,
        },
      },
      accessToken
    );
    business1Address = business1Data.data.getBusiness.tokenAddress;

    // Create second business
    const business2Result = await makeGraphQLRequest(
      CREATE_BUSINESS,
      {
        input: {
          name: "Second Test Business",
          chainId,
        },
      },
      accessToken
    );
    business2Id = business2Result.data.createBusiness.id;

    // Update second business data
    await makeGraphQLRequest(
      UPDATE_BUSINESS,
      {
        input: {
          id: business2Id,
          name: "Second Test Business",
          description: "Another business for portfolio testing",
          tags: ["test", "portfolio"],
          image: "https://example.com/image2.png",
        },
      },
      accessToken
    );

    // Update second business risk score
    await makeGraphQLRequest(
      UPDATE_BUSINESS_RISK_SCORE,
      {
        input: {
          id: business2Id,
        },
      },
      accessToken
    );

    // Request signatures for second business
    const signatures2Result = await makeGraphQLRequest(
      REQUEST_BUSINESS_APPROVAL_SIGNATURES,
      {
        input: {
          id: business2Id,
          userWallet: wallet.address,
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get signatures for second business
    const task2Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: signatures2Result.data.requestBusinessApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const signatures2 = task2Result.data.getSignatureTask.signatures;
    const signers2 = signatures2.map((sig: any) => ethers.getAddress(sig.signer));
    const signatureValues2 = signatures2.map((sig: any) => sig.signature);
    const expired2 = task2Result.data.getSignatureTask.expired;

    // Deploy second business contract
    const deploy2Tx = await factory.deployRWA(
      business2Id,
      signers2,
      signatureValues2,
      expired2,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deploy2Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get second business address
    const business2Data = await makeGraphQLRequest(
      GET_BUSINESS,
      {
        input: {
          id: business2Id,
        },
      },
      accessToken
    );
    business2Address = business2Data.data.getBusiness.tokenAddress;

    // Create pool for first business
    const pool1Result = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          businessId: business1Id,
        },
      },
      accessToken
    );
    pool1Id = pool1Result.data.createPool.id;

    // Update pool data
    await makeGraphQLRequest(
      UPDATE_POOL,
      {
        input: {
          id: pool1Id,
          description: "First business pool",
          tags: ["pool1", "test"],
          targetAmount: ethers.parseEther("15000").toString(),
          profitPercent: "500",
          investmentDuration: "36000",
          realiseDuration: "72000",
          speculationsEnabled: true,
        },
      },
      accessToken
    );

    // Update pool risk score
    await makeGraphQLRequest(
      UPDATE_POOL_RISK_SCORE,
      {
        input: {
          id: pool1Id,
        },
      },
      accessToken
    );

    // Request pool signatures
    const poolSig1Result = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: pool1Id,
          userWallet: wallet.address,
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const pool1Data = await makeGraphQLRequest(
      GET_POOL,
      {
        input: {
          id: pool1Id,
        },
      },
      accessToken
    );

    const poolTask1Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolSig1Result.data.requestPoolApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const poolSig1 = poolTask1Result.data.getSignatureTask.signatures;
    const poolSigners1 = poolSig1.map((sig: any) => ethers.getAddress(sig.signer));
    const poolSignatureValues1 = poolSig1.map((sig: any) => sig.signature);
    const poolExpired1 = poolTask1Result.data.getSignatureTask.expired;

    // Deploy first pool contract
    const pool1 = pool1Data.data.getPool;
    const deployPool1Tx = await factory.deployPool(
      pool1Id,
      pool1.rwaAddress,
      BigInt(pool1.targetAmount),
      BigInt(pool1.profitPercent),
      BigInt(pool1.investmentDuration),
      BigInt(pool1.realiseDuration),
      pool1.speculationsEnabled,
      poolSigners1,
      poolSignatureValues1,
      poolExpired1,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deployPool1Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Create first pool for second business
    const pool2Result = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          businessId: business2Id,
        },
      },
      accessToken
    );
    pool2Id = pool2Result.data.createPool.id;

    // Update pool data
    await makeGraphQLRequest(
      UPDATE_POOL,
      {
        input: {
          id: pool2Id,
          description: "Second business first pool",
          tags: ["pool2", "test"],
          targetAmount: ethers.parseEther("20000").toString(),
          profitPercent: "1000",
          investmentDuration: "36000",
          realiseDuration: "72000",
          speculationsEnabled: true,
        },
      },
      accessToken
    );

    // Update pool risk score
    await makeGraphQLRequest(
      UPDATE_POOL_RISK_SCORE,
      {
        input: {
          id: pool2Id,
        },
      },
      accessToken
    );

    // Request pool signatures
    const poolSig2Result = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: pool2Id,
          userWallet: wallet.address,
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const pool2Data = await makeGraphQLRequest(
      GET_POOL,
      {
        input: {
          id: pool2Id,
        },
      },
      accessToken
    );

    const poolTask2Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolSig2Result.data.requestPoolApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const poolSig2 = poolTask2Result.data.getSignatureTask.signatures;
    const poolSigners2 = poolSig2.map((sig: any) => ethers.getAddress(sig.signer));
    const poolSignatureValues2 = poolSig2.map((sig: any) => sig.signature);
    const poolExpired2 = poolTask2Result.data.getSignatureTask.expired;

    // Deploy second pool contract
    const pool2 = pool2Data.data.getPool;
    const deployPool2Tx = await factory.deployPool(
      pool2Id,
      pool2.rwaAddress,
      BigInt(pool2.targetAmount),
      BigInt(pool2.profitPercent),
      BigInt(pool2.investmentDuration),
      BigInt(pool2.realiseDuration),
      pool2.speculationsEnabled,
      poolSigners2,
      poolSignatureValues2,
      poolExpired2,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deployPool2Tx.wait(20);

    // Create second pool for second business
    const pool3Result = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          businessId: business2Id,
        },
      },
      accessToken
    );
    pool3Id = pool3Result.data.createPool.id;

    // Update pool data
    await makeGraphQLRequest(
      UPDATE_POOL,
      {
        input: {
          id: pool3Id,
          description: "Second business second pool",
          tags: ["pool3", "test"],
          targetAmount: ethers.parseEther("30000").toString(),
          profitPercent: "1500",
          investmentDuration: "36000",
          realiseDuration: "72000",
          speculationsEnabled: true,
        },
      },
      accessToken
    );

    // Update pool risk score
    await makeGraphQLRequest(
      UPDATE_POOL_RISK_SCORE,
      {
        input: {
          id: pool3Id,
        },
      },
      accessToken
    );

    // Request pool signatures
    const poolSig3Result = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: pool3Id,
          userWallet: wallet.address,
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const pool3Data = await makeGraphQLRequest(
      GET_POOL,
      {
        input: {
          id: pool3Id,
        },
      },
      accessToken
    );

    const poolTask3Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolSig3Result.data.requestPoolApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const poolSig3 = poolTask3Result.data.getSignatureTask.signatures;
    const poolSigners3 = poolSig3.map((sig: any) => ethers.getAddress(sig.signer));
    const poolSignatureValues3 = poolSig3.map((sig: any) => sig.signature);
    const poolExpired3 = poolTask3Result.data.getSignatureTask.expired;

    // Deploy third pool contract
    const pool3 = pool3Data.data.getPool;
    const deployPool3Tx = await factory.deployPool(
      pool3Id,
      pool3.rwaAddress,
      BigInt(pool3.targetAmount),
      BigInt(pool3.profitPercent),
      BigInt(pool3.investmentDuration),
      BigInt(pool3.realiseDuration),
      pool3.speculationsEnabled,
      poolSigners3,
      poolSignatureValues3,
      poolExpired3,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deployPool3Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get pool addresses
    const [updatedPool1, updatedPool2, updatedPool3] = await Promise.all([
      makeGraphQLRequest(GET_POOL, { input: { id: pool1Id } }, accessToken),
      makeGraphQLRequest(GET_POOL, { input: { id: pool2Id } }, accessToken),
      makeGraphQLRequest(GET_POOL, { input: { id: pool3Id } }, accessToken),
    ]);

    pool1Address = updatedPool1.data.getPool.poolAddress;
    pool2Address = updatedPool2.data.getPool.poolAddress;
    pool3Address = updatedPool3.data.getPool.poolAddress;
  });

  // Tests will be added here
  test('1', () => {
    console.log(chainId)
    console.log(wallet.address)
    console.log(wallet.privateKey)
    console.log('------')
    console.log(accessToken)
    console.log('------')
    console.log(userId)
    console.log(business1Id)
    console.log(business2Id)
    console.log(business1Address)
    console.log(business2Address)
    console.log(pool1Id)
    console.log(pool2Id)
    console.log(pool3Id)
    console.log(pool1Address)
    console.log(pool2Address)
    console.log(pool3Address)
  })

  
  test("should buy tokens from first pool and check balance", async () => {
    // Create pool contract instance
    const pool1Contract = new ethers.Contract(pool1Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const tokenId = await pool1Contract.tokenId();
    const rwaAddress = await pool1Contract.rwa();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const initialBalance = initialBalanceResult.data.getBalances[0]?.balance || 0;

    // Approve HOLD tokens for pool
    await holdToken.approve(pool1Address, ethers.MaxUint256);

    // Get amount out for 100 HOLD
    const amountIn = ethers.parseEther("100");
    const amountOut = await pool1Contract.getAmountOut(amountIn, false);

    // Buy tokens
    const buyTx = await pool1Contract.swapExactInput(
      amountIn,
      amountOut,
      false,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await buyTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from contract
    const finalContractBalance = await rwaToken.balanceOf(wallet.address, tokenId);

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balances
    expect(finalApiBalance).toBe(Number(finalContractBalance));
    expect(finalApiBalance).toBe(initialBalance + Number(amountOut));
  });
  
  test("should buy tokens from second pool and check balance", async () => {
    // Create pool contract instance
    const pool2Contract = new ethers.Contract(pool2Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const tokenId = await pool2Contract.tokenId();
    const rwaAddress = await pool2Contract.rwa();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
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
    await holdToken.approve(pool2Address, ethers.MaxUint256);

    // Get amount out for 150 HOLD
    const amountIn = ethers.parseEther("150");
    const amountOut = await pool2Contract.getAmountOut(amountIn, false);

    // Buy tokens
    const buyTx = await pool2Contract.swapExactInput(
      amountIn,
      amountOut,
      false,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await buyTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from contract
    const finalContractBalance = await rwaToken.balanceOf(wallet.address, tokenId);

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balances
    expect(finalApiBalance).toBe(Number(finalContractBalance));
    expect(finalApiBalance).toBe(initialBalance + Number(amountOut));
  });

  test("should buy tokens from third pool and check balance", async () => {
    // Create pool contract instance
    const pool3Contract = new ethers.Contract(pool3Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const tokenId = await pool3Contract.tokenId();
    const rwaAddress = await pool3Contract.rwa();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
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
    await holdToken.approve(pool3Address, ethers.MaxUint256);

    // Get amount out for 200 HOLD
    const amountIn = ethers.parseEther("200");
    const amountOut = await pool3Contract.getAmountOut(amountIn, false);

    // Buy tokens
    const buyTx = await pool3Contract.swapExactInput(
      amountIn,
      amountOut,
      false,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await buyTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from contract
    const finalContractBalance = await rwaToken.balanceOf(wallet.address, tokenId);

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balances
    expect(finalApiBalance).toBe(Number(finalContractBalance));
    expect(finalApiBalance).toBe(initialBalance + Number(amountOut));
  });

  test("should sell tokens back to first pool and check balance decrease", async () => {
    // Create pool contract instance
    const pool1Contract = new ethers.Contract(pool1Address, POOL_ABI, wallet);
    const holdToken = new ethers.Contract(HOLD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Get token info
    const tokenId = await pool1Contract.tokenId();
    const rwaAddress = await pool1Contract.rwa();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balance from contract
    const initialContractBalance = await rwaToken.balanceOf(wallet.address, tokenId);

    // Get initial balance from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const initialApiBalance = initialBalanceResult.data.getBalances[0]?.balance || 0;

    // Verify initial balances match
    expect(initialApiBalance).toBe(Number(initialContractBalance));

    // Approve RWA tokens for pool
    await rwaToken.setApprovalForAll(pool1Address, true);

    // Get amount out for selling all tokens
    const amountOut = await pool1Contract.getAmountOut(initialContractBalance, true);

    // Sell tokens
    const sellTx = await pool1Contract.swapExactInput(
      initialContractBalance,
      amountOut,
      true,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await sellTx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balance from contract
    const finalContractBalance = await rwaToken.balanceOf(wallet.address, tokenId);

    // Get final balance from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const finalApiBalance = finalBalanceResult.data.getBalances[0].balance;

    // Verify balances
    expect(finalApiBalance).toBe(Number(finalContractBalance));
    expect(finalApiBalance).toBeLessThan(initialApiBalance);
    expect(finalApiBalance).toBe(0); // Should be 0 after selling all tokens
  });

  test("should transfer tokens between wallets and check balances", async () => {
    // Create second wallet for testing
    const wallet2 = ethers.Wallet.createRandom().connect(provider);
    
    // Create pool contract instance and get token info
    const pool2Contract = new ethers.Contract(pool2Address, POOL_ABI, wallet);
    const tokenId = await pool2Contract.tokenId();
    const rwaAddress = await pool2Contract.rwa();
    const rwaToken = new ethers.Contract(rwaAddress, ERC1155_ABI, wallet);

    // Get initial balances from contract
    const initialContractBalance1 = await rwaToken.balanceOf(wallet.address, tokenId);
    const initialContractBalance2 = await rwaToken.balanceOf(wallet2.address, tokenId);

    // Get initial balances from API
    const initialBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address, wallet2.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const initialApiBalance1 = initialBalanceResult.data.getBalances[0]?.balance || 0;
    const initialApiBalance2 = initialBalanceResult.data.getBalances[1]?.balance || 0;

    // Verify initial balances match
    expect(initialApiBalance1).toBe(Number(initialContractBalance1));
    expect(initialApiBalance2).toBe(Number(initialContractBalance2));

    // Transfer half of tokens to wallet2
    const transferAmount = initialContractBalance1 / BigInt(2);
    await rwaToken.safeTransferFrom(
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

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final balances from contract
    const finalContractBalance1 = await rwaToken.balanceOf(wallet.address, tokenId);
    const finalContractBalance2 = await rwaToken.balanceOf(wallet2.address, tokenId);

    // Get final balances from API
    const finalBalanceResult = await makeGraphQLRequest(
      GET_BALANCES,
      {
        input: {
          owners: [wallet.address, wallet2.address],
          tokenAddresses: [rwaAddress],
          chainIds: [chainId]
        }
      },
      accessToken
    );
    const finalApiBalance1 = finalBalanceResult.data.getBalances[0].balance;
    const finalApiBalance2 = finalBalanceResult.data.getBalances[1].balance;

    // Verify final balances match between contract and API
    expect(finalApiBalance1).toBe(Number(finalContractBalance1));
    expect(finalApiBalance2).toBe(Number(finalContractBalance2));

    // Verify balance changes
    expect(finalApiBalance1).toBeLessThan(initialApiBalance1);
    expect(finalApiBalance2).toBeGreaterThan(initialApiBalance2);

    // Verify transfer amount
    expect(finalApiBalance1).toBe(initialApiBalance1 - Number(transferAmount));
    expect(finalApiBalance2).toBe(initialApiBalance2 + Number(transferAmount));

    // Total amount should remain the same
    expect(finalApiBalance1 + finalApiBalance2).toBe(initialApiBalance1 + initialApiBalance2);
  });
});
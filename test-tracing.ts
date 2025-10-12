import { ethers } from 'ethers';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const GATEWAY_URL = "https://localhost/gateway/graphql";

async function makeGraphQLRequest(
  query: string,
  variables: Record<string, any>,
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  });
  console.log(JSON.stringify(response.headers, null, 4))

  return response.json();
}

async function generateTypedData(signer: any, timestamp?: number) {
  timestamp ??= Math.floor(Date.now() / 1000);
  const message = `Welcome to RWA Platform!

We prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.`;

  return {
    types: {
      Message: [
        { name: "wallet", type: "address" },
        { name: "timestamp", type: "uint256" },
        { name: "message", type: "string" },
      ],
    },
    primaryType: "Message",
    domain: {
      name: "RWA Platform",
      version: "1",
    },
    message: {
      wallet: await signer.getAddress(),
      timestamp,
      message,
    },
  };
}

const AUTHENTICATE = `
  mutation authenticate($input: AuthenticateInput!) {
    authenticate(input: $input) {
      userId
      wallet
      accessToken
      refreshToken
    }
  }
`;

async function testTracing() {
  console.log('🔍 Testing tracing between services...');
  
  const wallet = ethers.Wallet.createRandom();
  const typedData = await generateTypedData(wallet);
  
  const signature = await wallet.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message
  );

  console.log(`📝 Generated test data:
  - Wallet: ${wallet.address}
  - Timestamp: ${typedData.message.timestamp}
  - Signature: ${signature.substring(0, 20)}...`);

  try {
    console.log('🚀 Making GraphQL request...');
    
    const result = await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature,
        timestamp: typedData.message.timestamp,
      },
    });
    
    console.log('✅ Response received:', JSON.stringify(result, null, 2));
    
    if (result.errors) {
      console.log('❌ GraphQL errors:', result.errors);
    } else {
      console.log('🎉 Authentication successful!');
      console.log('📊 Check Grafana traces now to see the distributed trace!');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testTracing().catch(console.error);
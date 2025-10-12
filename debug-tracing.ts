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
    'traceparent': '00-' + Array(32).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('') + '-' + Array(16).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('') + '-01'
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

async function debugTracing() {
  console.log('🔍 DEBUG: Testing tracing with detailed logging...');
  
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
    console.log('📊 Expected spans to see:');
    console.log('  1. nginx_graphql_proxy (nginx)');
    console.log('  2. POST /graphql (gateway)');
    console.log('  3. GraphQL operation (gateway)');
    console.log('  4. HTTP request to auth (gateway)');
    console.log('  5. POST /authenticate (auth)');
    console.log('  6. MongoDB operations (auth) ← SHOULD BE HERE');
    console.log('  7. Redis operations (if any) ← SHOULD BE HERE');
    console.log('');
    
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
      console.log('');
      console.log('📊 Now check Grafana Tempo:');
      console.log('1. Go to Grafana → Explore → Tempo');
      console.log('2. Search for traces in last 5 minutes');
      console.log('3. Look for trace with operations:');
      console.log('   - nginx_graphql_proxy');
      console.log('   - POST /authenticate');
      console.log('   - MongoDB operations (db.find, db.insert, etc.)');
      console.log('   - Redis operations (if any)');
      console.log('');
      console.log('🔍 If you don\'t see MongoDB/Redis spans:');
      console.log('1. Check auth service logs for OpenTelemetry initialization');
      console.log('2. Verify auto-instrumentations are loaded');
      console.log('3. Check if MongoDB/Redis are actually being called');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

debugTracing().catch(console.error);
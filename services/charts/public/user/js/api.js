class API {
    constructor() {
        this.endpoint = '/graphql';
    }

    async makeGraphQLRequest(query, variables) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            const data = await response.json();
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }
            return data.data;
        } catch (error) {
            console.error('GraphQL request failed:', error);
            throw error;
        }
    }

    generateTypedData(wallet, timestamp, message) {
        timestamp ??= Math.floor(Date.now() / 1000);
        message ??= `Welcome to RWA Platform!

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
                wallet,
                timestamp,
                message,
            },
        };
    }

    async connectWallet() {
        if (!window.ethereum) {
            throw new Error('MetaMask is not installed');
        }

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const wallet = accounts[0];

        // Get signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Generate and sign typed data
        const typedData = this.generateTypedData(wallet);
        const signature = await signer.signTypedData(
            typedData.domain,
            typedData.types,
            typedData.message
        );

        // Authenticate
        const result = await this.authenticate(wallet, signature, typedData.message.timestamp);

        // Store tokens
        localStorage.setItem('accessToken', result.authenticate.accessToken);
        localStorage.setItem('refreshToken', result.authenticate.refreshToken);
        localStorage.setItem('userId', result.authenticate.userId);
        localStorage.setItem('wallet', result.authenticate.wallet);

        return result.authenticate;
    }

    async authenticate(wallet, signature, timestamp) {
        const query = `
            mutation Authenticate($input: AuthenticateInput!) {
                authenticate(input: $input) {
                    userId
                    wallet
                    accessToken
                    refreshToken
                }
            }
        `;

        const variables = {
            input: {
                wallet,
                signature,
                timestamp
            }
        };

        return this.makeGraphQLRequest(query, variables);
    }

    async refreshToken(refreshToken) {
        const query = `
            mutation RefreshToken($input: RefreshTokenInput!) {
                refreshToken(input: $input) {
                    userId
                    wallet
                    accessToken
                    refreshToken
                }
            }
        `;

        const variables = {
            input: {
                refreshToken
            }
        };

        return this.makeGraphQLRequest(query, variables);
    }

    async getBalances(filter = {}, sort = {}, limit = 100, offset = 0) {
        const query = `
            query GetBalances($input: GetBalancesInput!) {
                getBalances(input: $input) {
                    id
                    owner
                    tokenAddress
                    tokenId
                    pool
                    chainId
                    balance
                    lastUpdateBlock
                    createdAt
                    updatedAt
                }
            }
        `;

        const variables = {
            input: {
                filter,
                sort,
                limit,
                offset
            }
        };

        return this.makeGraphQLRequest(query, variables);
    }

    async getTransactions(filter = {}, sort = {}, limit = 100, offset = 0) {
        const query = `
            query GetTransactions($input: GetTransactionsInput!) {
                getTransactions(input: $input) {
                    id
                    from
                    to
                    tokenAddress
                    tokenId
                    pool
                    chainId
                    transactionHash
                    blockNumber
                    amount
                    createdAt
                    updatedAt
                }
            }
        `;

        const variables = {
            input: {
                filter,
                sort,
                limit,
                offset
            }
        };

        return this.makeGraphQLRequest(query, variables);
    }
}

const api = new API();
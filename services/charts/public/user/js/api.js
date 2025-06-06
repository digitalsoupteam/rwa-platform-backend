async function makeGraphQLRequest(query, variables, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('https://localhost/gateway/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            query,
            variables
        })
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0].message);
    }
    return result.data;
}

async function authenticate(wallet, signature, timestamp) {
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

    return makeGraphQLRequest(query, {
        input: {
            wallet,
            signature,
            timestamp
        }
    });
}

async function refreshTokenRequest(token) {
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

    return makeGraphQLRequest(query, {
        input: {
            refreshToken: token
        }
    });
}

async function requestHoldRequest(amount) {
    const query = `
        mutation RequestHold($input: RequestTokenInput!) {
            requestHold(input: $input) {
                id
                userId
                wallet
                tokenType
                amount
                transactionHash
                createdAt
            }
        }
    `;

    return makeGraphQLRequest(query, {
        input: {
            amount
        }
    }, localStorage.getItem('accessToken'));
}

async function requestGasRequest(amount) {
    const query = `
        mutation RequestGas($input: RequestTokenInput!) {
            requestGas(input: $input) {
                id
                userId
                wallet
                tokenType
                amount
                transactionHash
                createdAt
            }
        }
    `;

    return makeGraphQLRequest(query, {
        input: {
            amount
        }
    }, localStorage.getItem('accessToken'));
}

async function getUnlockTime() {
    const query = `
        query GetUnlockTime {
            getUnlockTime {
                gasUnlockTime
                holdUnlockTime
            }
        }
    `;

    return makeGraphQLRequest(query, {}, localStorage.getItem('accessToken'));
}
async function makeGraphQLRequest(query, variables) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        throw new Error('Authentication required');
    }
    const response = await fetch('https://localhost/gateway/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
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

async function createPool(input) {
    console.log(JSON.stringify(input, null, 4))
    const query = `
        mutation CreatePool($input: CreatePoolInput!) {
            createPool(input: $input) {
                id
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}

async function updatePool(id, updateData) {
    const query = `
        mutation EditPool($input: EditPoolInput!) {
            editPool(input: $input) {
                id
            }
        }
    `;
    return makeGraphQLRequest(query, { 
        input: {
            id,
            updateData
        }
    });
}

async function updatePoolRiskScore(id) {
    const query = `
        mutation UpdatePoolRiskScore($id: ID!) {
            updatePoolRiskScore(id: $id) {
                id
                riskScore
            }
        }
    `;
    return makeGraphQLRequest(query, { id });
}

async function requestPoolApprovalSignatures(input) {
    const query = `
        mutation RequestPoolApprovalSignatures($input: RequestPoolApprovalSignaturesInput!) {
            requestPoolApprovalSignatures(input: $input) {
                taskId
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}

async function getPools(input = {}) {
    const query = `
        query GetPools($input: FilterInput!) {
            getPools(input: $input) {
                id
                name
                description
                businessId
                rwaAddress
                poolAddress
                expectedHoldAmount
                expectedRwaAmount
                priceImpactPercent
                rewardPercent
                entryPeriodStart
                entryPeriodExpired
                completionPeriodExpired
                entryFeePercent
                exitFeePercent
                fixedSell
                allowEntryBurn
                awaitCompletionExpired
                floatingOutTranchesTimestamps
                outgoingTranches {
                    amount
                    timestamp
                    executedAmount
                }
                incomingTranches {
                    amount
                    expiredAt
                    returnedAmount
                }
                approvalSignaturesTaskId
                approvalSignaturesTaskExpired
                createdAt
                updatedAt
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}

async function getPool(id) {
    const query = `
        query GetPool($id: ID!) {
            getPool(id: $id) {
                id
                name
                description
                businessId
                rwaAddress
                expectedHoldAmount
                expectedRwaAmount
                priceImpactPercent
                rewardPercent
                entryPeriodStart
                entryPeriodExpired
                completionPeriodExpired
                entryFeePercent
                exitFeePercent
                fixedSell
                allowEntryBurn
                awaitCompletionExpired
                floatingOutTranchesTimestamps
                outgoingTranches {
                    amount
                    timestamp
                    executedAmount
                }
                incomingTranches {
                    amount
                    expiredAt
                    returnedAmount
                }
                approvalSignaturesTaskId
                approvalSignaturesTaskExpired
            }
        }
    `;
    return makeGraphQLRequest(query, { id });
}

async function getSignatureTask(taskId) {
    const query = `
        query GetSignatureTask($input: GetSignatureTaskInput!) {
            getSignatureTask(input: $input) {
                id
                ownerId
                ownerType
                hash
                requiredSignatures
                expired
                completed
                signatures {
                    signer
                    signature
                }
            }
        }
    `;
    return makeGraphQLRequest(query, { input: { taskId } });
}

async function getUserCompanies() {
    const query = `
        query GetCompanies($input: GetCompaniesInput) {
            getCompanies(input: $input) {
                id
                name
                description
                ownerId
                createdAt
                updatedAt
            }
        }
    `;
    const userId = localStorage.getItem('userId');
    return makeGraphQLRequest(query, { input: { filter: { ownerId: userId } } });
}

async function getBusinesses(input = {}) {
    const query = `
        query GetBusinesses($input: FilterInput!) {
            getBusinesses(input: $input) {
                id
                name
                description
                ownerId
                ownerType
                ownerWallet
                chainId
                tags
                riskScore
                tokenAddress
                approvalSignaturesTaskId
                approvalSignaturesTaskExpired
                createdAt
                updatedAt
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}
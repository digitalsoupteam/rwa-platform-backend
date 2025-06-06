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

async function createBusiness(input) {
    const query = `
        mutation CreateBusiness($input: CreateBusinessInput!) {
            createBusiness(input: $input) {
                id
                name
                description
                ownerId
                ownerType
                ownerWallet
                chainId
                tags
                riskScore
                image
                createdAt
                updatedAt
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}

async function editBusiness(input) {
    const query = `
        mutation EditBusiness($input: EditBusinessInput!) {
            editBusiness(input: $input) {
                id
                name
                description
                ownerId
                ownerType
                ownerWallet
                chainId
                tags
                riskScore
                image
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

async function updateBusinessRiskScore(id) {
    const query = `
                    mutation UpdateBusinessRiskScore($id: ID!) {
                        updateBusinessRiskScore(id: $id) {
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
    return makeGraphQLRequest(query, { id });
}

async function requestBusinessApprovalSignatures(input) {
    const query = `
                    mutation RequestBusinessApprovalSignatures($input: RequestBusinessApprovalSignaturesInput!) {
                        requestBusinessApprovalSignatures(input: $input) {
                            taskId
                        }
                    }
                `;
    return makeGraphQLRequest(query, { input });
}

async function getBusinessDetails(id) {
    const query = `
        query GetBusiness($id: ID!) {
            getBusiness(id: $id) {
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
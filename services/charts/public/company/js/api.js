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

async function createCompany(input) {
    const query = `
        mutation CreateCompany($input: CreateCompanyInput!) {
            createCompany(input: $input) {
                id
                name
                description
                ownerId
                createdAt
                updatedAt
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}

async function updateCompany(input) {
    const query = `
        mutation UpdateCompany($input: UpdateCompanyInput!) {
            updateCompany(input: $input) {
                id
                name
                description
                ownerId
                createdAt
                updatedAt
            }
        }
    `;
    return makeGraphQLRequest(query, { input });
}

async function deleteCompany(id) {
    const query = `
        mutation DeleteCompany($id: ID!) {
            deleteCompany(id: $id)
        }
    `;
    return makeGraphQLRequest(query, { id });
}

async function getCompanies(input = {}) {
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
    return makeGraphQLRequest(query, { input });
}

async function getCompanyDetails(id) {
    const query = `
        query GetCompany($id: ID!) {
            getCompany(id: $id) {
                id
                name
                description
                ownerId
                users {
                    id
                    userId
                    name
                    permissions {
                        id
                        permission
                        entity
                    }
                }
                createdAt
                updatedAt
            }
        }
    `;
    return makeGraphQLRequest(query, { id });
}
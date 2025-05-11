export const CREATE_COMPANY = `
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

export const UPDATE_COMPANY = `
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

export const DELETE_COMPANY = `
  mutation DeleteCompany($id: ID!) {
    deleteCompany(id: $id)
  }
`;

export const GET_COMPANY = `
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

export const GET_COMPANIES = `
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

export const ADD_MEMBER = `
  mutation AddMember($input: AddMemberInput!) {
    addMember(input: $input) {
      id
      userId
      name
      createdAt
      updatedAt
    }
  }
`;

export const REMOVE_MEMBER = `
  mutation RemoveMember($input: RemoveMemberInput!) {
    removeMember(input: $input)
  }
`;

export const GRANT_PERMISSION = `
  mutation GrantPermission($input: GrantPermissionInput!) {
    grantPermission(input: $input) {
      id
      permission
      entity
      createdAt
      updatedAt
    }
  }
`;

export const REVOKE_PERMISSION = `
  mutation RevokePermission($input: RevokePermissionInput!) {
    revokePermission(input: $input)
  }
`;
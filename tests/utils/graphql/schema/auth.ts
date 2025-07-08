export const AUTHENTICATE = `
  mutation Authenticate($input: AuthenticateInput!) {
    authenticate(input: $input) {
      userId
      wallet
      accessToken
      refreshToken
    }
  }
`;

export const REFRESH_TOKEN = `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      userId
      wallet
      accessToken
      refreshToken
    }
  }
`;

export const GET_USER_TOKENS = `
  query GetUserTokens {
    getUserTokens {
      tokenId
      userId
      tokenHash
      expiresAt
      createdAt
      updatedAt
    }
  }
`;

export const REVOKE_TOKENS = `
  mutation RevokeTokens($input: RevokeTokensInput!) {
    revokeTokens(input: $input) {
      revokedCount
    }
  }
`;
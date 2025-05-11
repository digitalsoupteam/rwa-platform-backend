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
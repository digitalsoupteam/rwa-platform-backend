export interface TypeProperty {
  name: string;
  type: string;
}

export interface Person {
  name: string;
  wallet: string;
}

export interface SignatureRequest {
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
  types: {
    Person: TypeProperty[];
    Mail: TypeProperty[];
  };
  primaryType: string;
  message: {
    from: Person;
    to: Person;
    contents: string;
  };
}

export interface GetAuthMessageResponse {
  getAuthMessage: SignatureRequest;
}

export interface AuthenticateResponse {
  authenticate: {
    token: string;
  };
}

export interface AuthenticateVariables {
  address: string;
  signature: string;
}

export interface StartKYCResponse {
  startKYC: {
    success: boolean;
    message: string;
  };
}

export interface Enterprise {
  id: string;
  name: string;
  description: string;
  status: string;
  tokenAddress: string;
  owner: string;
}

export interface GetEnterprisesResponse {
  enterprises: Enterprise[];
}

export interface CreateEnterpriseInput {
  name: string;
  description: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: string;
}

export interface CreateEnterpriseResponse {
  createEnterprise: Enterprise;
}

export interface CreateEnterpriseVariables {
  input: CreateEnterpriseInput;
}

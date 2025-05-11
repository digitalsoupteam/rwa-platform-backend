export const GET_SIGNATURE_TASK = `
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
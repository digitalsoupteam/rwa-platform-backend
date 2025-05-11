import type { Signer } from "ethers";
import { generateTypedData } from "./generateTypedData";
import { makeGraphQLRequest } from "./graphql/makeGraphQLRequest";
import { AUTHENTICATE } from "./graphql/schema/auth";

export async function authenticate(signer: Signer) {
  const typedData = await generateTypedData(signer);
  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message
  );

  const result = await makeGraphQLRequest(AUTHENTICATE, {
    input: {
      wallet: await signer.getAddress(),
      signature,
      timestamp: typedData.message.timestamp
    },
  });

  if(result.errors) throw `authenticate error ${result.errors}`

  return {
    userId: result.data.authenticate.userId as string,
    wallet: result.data.authenticate.wallet as string,
    accessToken: result.data.authenticate.accessToken as string,
    refreshToken: result.data.authenticate.refreshToken as string,
  };
}

import { makeGraphQLRequest } from "./graphql/makeGraphQLRequest";
import { REQUEST_GAS, REQUEST_HOLD } from "./graphql/schema/testnet-faucet";

export async function requestGas(accessToken: string, amount?: number) {
  amount ??= 0.0001;
  const result = await makeGraphQLRequest(
    REQUEST_GAS,
    {
      input: {
        amount,
      },
    },
    accessToken
  );

  if (result.errors) throw `requestGas error ${result.errors}`;
}

export async function requestHold(accessToken: string, amount?: number) {
  amount ??= 1000;
  const result = await makeGraphQLRequest(
    REQUEST_HOLD,
    {
      input: {
        amount,
      },
    },
    accessToken
  );

  if (result.errors) throw `requestHold error ${result.errors}`;
}

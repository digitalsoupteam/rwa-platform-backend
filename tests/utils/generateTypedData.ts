import type { Signer } from "ethers";

export async function generateTypedData(
  signer: Signer,
  timestamp?: number,
  message?: string
) {
  timestamp ??= Math.floor(Date.now() / 1000);
  message ??= `Welcome to RWA Platform!

We prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.`;

  return {
    types: {
    //   EIP712Domain: [
    //     { name: "name", type: "string" },
    //     { name: "version", type: "string" },
    //   ],
      Message: [
        { name: "wallet", type: "address" },
        { name: "timestamp", type: "uint256" },
        { name: "message", type: "string" },
      ],
    },
    primaryType: "Message",
    domain: {
      name: "RWA Platform",
      version: "1",
    },
    message: {
      wallet: await signer.getAddress(),
      timestamp,
      message,
    },
  };
}

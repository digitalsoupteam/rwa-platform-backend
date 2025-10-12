import { logger } from "@shared/monitoring/src/logger";
import { ethers, Wallet } from "ethers";
import { SignersManagerClient } from "../clients/signersManager.client";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

/**
 * Service for handling digital signatures
 */
@TracingDecorator()
export class SignatureService {
  private readonly wallet: Wallet;

  constructor(
    private readonly signersManagerClient: SignersManagerClient,
    privateKey: string
  ) {
    this.wallet = new Wallet(privateKey);
  }

  /**
   * Sign hash with private key and send result back
   */
  async signHash(
    hash: string,
    taskId: string,
    expired: number,
  ) {
    logger.debug("Signing hash for task", { taskId });

    const now = Math.floor(Date.now() / 1000);
    if (expired < now) {
      throw new Error("Task expired");
    }

    const hashToSign = ethers.solidityPackedKeccak256(
      ["bytes32", "uint256"],
      [
        hash,
        expired,
      ]
    );

    // Sign hash using ethers
    const signer = this.wallet.address;
    const signature = await this.wallet.signMessage(ethers.getBytes(hashToSign));

    // Send signature back to the manager
    await this.signersManagerClient.sendSignature({
      taskId,
      signer,
      hash,
      signature
    });
    
    logger.info("Successfully signed hash", {
      taskId,
      hash,
      signature
    });

    return { signer, signature };
  }

  /**
   * Get signer's public address
   */
  getSignerAddress(): string {
    return this.wallet.address;
  }
}
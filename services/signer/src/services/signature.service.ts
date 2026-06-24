import { ethers, Wallet } from "ethers";
import { SignersManagerClient } from "../clients/signersManager.client";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";
import { MetricsDecorator } from "@shared/monitoring/src/metricsDecorator";
import { LogDecorator } from "@shared/monitoring/src/logDecorator";
import { setSpanAttributes } from "@shared/monitoring/src/tracing";
import { AppError } from "@shared/errors/app-errors";

/**
 * Service for handling digital signatures
 */

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['hash', 'taskId', 'expired'] })
  async signHash(
    hash: string,
    taskId: string,
    expired: number,
  ) {
    setSpanAttributes({
      wallet: this.wallet.address,
      hash,
      taskId,
      expired,
    });
    const now = Math.floor(Date.now() / 1000);
    if (expired < now) {
      throw new AppError({ message: "Task expired", statusCode: 410, code: "EXPIRED" });
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

    return { signer, signature };
  }

  /**
   * Get signer's public address
   */
  getSignerAddress(): string {
    return this.wallet.address;
  }
}
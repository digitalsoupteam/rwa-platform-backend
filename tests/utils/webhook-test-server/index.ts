import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export interface WebhookDelivery {
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

export interface WebhookTestServer {
  start(): Promise<number>;
  stop(): void;
  getDeliveries(): WebhookDelivery[];
  getLastDelivery(): WebhookDelivery | undefined;
  clearDeliveries(): void;
  getPort(): number;
  getUrl(): string;
}

function generateSelfSignedCert(): { key: string; cert: string } {
  const id = randomUUID();
  const keyPath = join(tmpdir(), `webhook-test-key-${id}.pem`);
  const certPath = join(tmpdir(), `webhook-test-cert-${id}.pem`);

  const result = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-days",
    "1",
    "-nodes",
    "-subj",
    "/CN=localhost",
  ]);

  if (result.exitCode !== 0) {
    const stderr = result.stderr ? String(result.stderr) : undefined;
    throw new Error(`Failed to generate self-signed cert: ${stderr || "unknown error"}`);
  }

  const key = readFileSync(keyPath, "utf-8");
  const cert = readFileSync(certPath, "utf-8");

  try {
    unlinkSync(keyPath);
    unlinkSync(certPath);
  } catch {
    // best effort
  }

  return { key, cert };
}

export function createWebhookTestServer(): WebhookTestServer {
  let deliveries: WebhookDelivery[] = [];
  let server: ReturnType<typeof Bun.serve> | null = null;
  let port = 0;

  const handler = async (req: Request): Promise<Response> => {
    if (req.method === "POST") {
      const body = await req.json();
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });

      deliveries.push({
        headers,
        body,
        timestamp: Date.now(),
      });

      return new Response("OK", { status: 200 });
    }

    if (req.method === "GET") {
      return new Response(JSON.stringify({ deliveries: deliveries.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  };

  return {
    async start(): Promise<number> {
      const { key, cert } = generateSelfSignedCert();

      return new Promise((resolve) => {
        server = Bun.serve({
          key,
          cert,
          port: 0,
          fetch: handler,
        });

        port = server.port as number;
        resolve(port);
      });
    },

    stop() {
      if (server) {
        server.stop();
        server = null;
      }
      port = 0;
      deliveries = [];
    },

    getDeliveries(): WebhookDelivery[] {
      return [...deliveries];
    },

    getLastDelivery(): WebhookDelivery | undefined {
      return deliveries[deliveries.length - 1];
    },

    clearDeliveries() {
      deliveries = [];
    },

    getPort(): number {
      return port;
    },

    getUrl(): string {
      return `https://localhost:${port}/webhook`;
    },
  };
}

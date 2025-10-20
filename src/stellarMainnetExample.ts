/**
 * Example helper demonstrating how to use `stellar-sdk` to craft, sign, and
 * submit a transaction on Stellar mainnet. This file is illustrative and is
 * not imported anywhere else in the app.
 *
 * Steps:
 * 1. Create a Server instance pointed at the public Horizon endpoint.
 * 2. Load the source account sequence number from Horizon.
 * 3. Build the transaction with the desired operations.
 * 4. Sign the transaction locally with the source account secret key.
 * 5. Submit the signed XDR back to Horizon.
 *
 * IMPORTANT: Never hardcode production secret keys inside your source tree.
 * Inject them securely via environment variables or a secret manager.
 */

import {
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Asset,
  Operation,
  StrKey,
  TransactionBuilder,
  xdr, 
  SorobanRpc
} from 'stellar-sdk';

import { PoolContract, RequestType } from '@blend-capital/blend-sdk';

const HORIZON_MAINNET_URL = 'https://horizon.stellar.org';
const SOROBAN_RPC_URL = 'https://mainnet.sorobanrpc.com';

/**
 * Builds, signs, and submits a simple payment from the supplied source account
 * to the destination account.
 *
 * @param sourceSecret - Secret key for the funding account (keep safe!).
 * @param destinationPublicKey - Public key of the recipient.
 * @param amount - Amount in lumens (XLM) to transfer as a string.
 */
export async function sendPaymentOnMainnet(
  sourceSecret: string,
  destinationPublicKey: string,
  amount: string
): Promise<void> {
  const server = new Horizon.Server(HORIZON_MAINNET_URL);

  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccountResponse = await server.loadAccount(sourceKeypair.publicKey());

  const transaction = new TransactionBuilder(sourceAccountResponse, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset: Asset.native(),
        amount
      })
    )
    .setTimeout(60)
    .build();

  transaction.sign(sourceKeypair);

  const result = await submitTransactionWithContext(server, transaction);
  console.log('Transaction succeeded on mainnet:', result);
}

/**
 * Sends a payment for a non-native Stellar asset (credit asset).
 *
 * Requirements:
 * - The sender must hold the asset and have a sufficient balance.
 * - The recipient must have a trustline to the asset issuer.
 */
export async function sendAssetPaymentOnMainnet(
  sourceSecret: string,
  destinationPublicKey: string,
  assetCode: string,
  assetIssuerPublicKey: string,
  amount: string
): Promise<void> {
  const server = new Horizon.Server(HORIZON_MAINNET_URL);
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccountResponse = await server.loadAccount(sourceKeypair.publicKey());

  const asset = new Asset(assetCode, assetIssuerPublicKey);

  const transaction = new TransactionBuilder(sourceAccountResponse, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount
      })
    )
    .setTimeout(60)
    .build();

  transaction.sign(sourceKeypair);

  const result = await submitTransactionWithContext(server, transaction);
  console.log(`Asset payment (${assetCode}) succeeded on mainnet:`, result);
}

/**
 * Creates or updates a trustline for the given asset on behalf of the account
 * identified by `accountSecret`.
 */
export async function createTrustlineOnMainnet(
  accountSecret: string,
  assetCode: string,
  assetIssuerPublicKey: string,
  limit?: string
): Promise<void> {
  if (!StrKey.isValidEd25519PublicKey(assetIssuerPublicKey)) {
    throw new Error('Asset issuer must be a valid Stellar public key (G...).');
  }

  const server = new Horizon.Server(HORIZON_MAINNET_URL);
  const accountKeypair = Keypair.fromSecret(accountSecret);
  const accountResponse = await server.loadAccount(accountKeypair.publicKey());

  const asset = new Asset(assetCode, assetIssuerPublicKey);

  const transaction = new TransactionBuilder(accountResponse, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        limit
      })
    )
    .setTimeout(60)
    .build();

  transaction.sign(accountKeypair);

  const result = await submitTransactionWithContext(server, transaction);
  console.log(`Trustline established/updated for ${assetCode}:`, result);
}

const parseAxiosError = (error: unknown): string | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: boolean }).isAxiosError
  ) {
    const axiosErr = error as {
      response?: { status: number; statusText?: string; data?: unknown };
      message?: string;
    };

    const status = axiosErr.response?.status;
    const statusText = axiosErr.response?.statusText;
    const message = axiosErr.message ?? 'Request failed';
    const data = axiosErr.response?.data;

    const parts = [
      status ? `HTTP ${status}` : null,
      statusText || null,
      message || null,
      data ? `Response: ${JSON.stringify(data)}` : null
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' – ') : 'Network request failed (Axios).';
  }

  return null;
};

const parseHorizonError = (error: unknown): string | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    'status' in (error as Record<string, unknown>)
  ) {
    try {
      const response = (error as { response: Record<string, unknown> }).response;
      const status = response?.status as number | undefined;
      const title = (response?.data as { title?: string })?.title;
      const detail = (response?.data as { detail?: string })?.detail;
      const extras = (response?.data as { extras?: Record<string, unknown> })?.extras;

      const horizonParts = [
        status ? `Horizon HTTP ${status}` : null,
        title || null,
        detail || null,
        extras ? `Extras: ${JSON.stringify(extras)}` : null
      ].filter(Boolean);

      if (horizonParts.length > 0) {
        return horizonParts.join(' – ');
      }
    } catch {
      /* ignore parsing errors */
    }
  }

  return null;
};

export const formatStellarError = (error: unknown, fallbackMessage: string): string => {
  const axiosInfo = parseAxiosError(error);
  const horizonInfo = parseHorizonError(error);

  if (axiosInfo || horizonInfo) {
    return [axiosInfo, horizonInfo].filter(Boolean).join(' | ');
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return String((error as { message?: unknown }).message);
  }

  return fallbackMessage;
};

async function submitTransactionWithContext(
  server: Horizon.Server,
  transaction: ReturnType<TransactionBuilder['build']>
) {
  try {
    return await server.submitTransaction(transaction);
  } catch (error) {
    throw new Error(formatStellarError(error, 'Transaction failed.'));
  }
}

export const InteractPoolOp = (supply: boolean) => 
  async (
  sourceSecret: string,
  poolId: string,
  asset: string,
  amount: bigint): Promise<void> => {
  const horizonServer = new Horizon.Server(HORIZON_MAINNET_URL);
  const sorobanServer = new SorobanRpc.Server(SOROBAN_RPC_URL);
  
  const keypair = Keypair.fromSecret(sourceSecret);
  const account = await horizonServer.loadAccount(keypair.publicKey());

  const poolContract = new PoolContract(poolId);

  const supplyOpBase64 = poolContract.submit({
    from: keypair.publicKey(),
    spender: keypair.publicKey(),
    to: keypair.publicKey(),
    requests: [
      {
        amount,
        request_type: supply? RequestType.SupplyCollateral : RequestType.WithdrawCollateral,
        address: asset
      }
    ]
  });

  const supplyOperation = xdr.Operation.fromXDR(supplyOpBase64, 'base64');

  let transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC
  })
    .addOperation(supplyOperation)
    .setTimeout(60)
    .build();

  // Simulate and prepare the transaction
  transaction = await sorobanServer.prepareTransaction(transaction);

  transaction.sign(keypair);

  const result = await sorobanServer.sendTransaction(transaction);
  console.log('Supply operation submitted:', result);
  console.log("TxHash", result.hash)
}

export const SupplyOp = InteractPoolOp(true)
export const WithdrawalOp = InteractPoolOp(false)
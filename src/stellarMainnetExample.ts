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
  TransactionBuilder
} from 'stellar-sdk';

const HORIZON_MAINNET_URL = 'https://horizon.stellar.org';

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
  // 1. Connect to the public Horizon server.
  const server = new Horizon.Server(HORIZON_MAINNET_URL);

  // 2. Derive the source Keypair and load the up-to-date account state.
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccountResponse = await server.loadAccount(sourceKeypair.publicKey());

  // 3. Build the payment transaction. Adjust timeouts/operations as needed.
  const transaction = new TransactionBuilder(
    sourceAccountResponse,
    {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC
    }
  )
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset: Asset.native(),
        amount
      })
    )
    .setTimeout(60) // Fail if not submitted within 60 seconds.
    .build();

  // 4. Sign with the source account secret so Horizon can verify authenticity.
  transaction.sign(sourceKeypair);

  // 5. Submit the signed XDR back to the public network.
  const result = await server.submitTransaction(transaction);
  console.log('Transaction succeeded on mainnet:', result);
}

/**
 * Example invocation (commented out). Replace the placeholders with real keys
 * and amounts when ready, then call the function from an async context.
 *
 * ```
 * await sendPaymentOnMainnet(
 *   process.env.STELLAR_SECRET!,
 *   'G...DESTINATION_PUBLIC_KEY...',
 *   '10.5'
 * );
 * ```
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { Keypair } from 'stellar-sdk';
import {
  sendAssetPaymentOnMainnet,
  sendPaymentOnMainnet,
  createTrustlineOnMainnet,
  supplyOp,
  withdrawalOp,
  poolData,
  formatStellarError
} from './stellarMainnetExample';

const stellarSecret = import.meta.env.VITE_STELLAR_SECRET_KEY ?? '';

type WalletDetails = {
  publicKey: string;
  secretKey: string;
};

const App = () => {
  const { ready, authenticated, user, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [wallet, setWallet] = useState<WalletDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sendCodeInFlight, setSendCodeInFlight] = useState(false);
  const [loginInFlight, setLoginInFlight] = useState(false);
  const [logoutInFlight, setLogoutInFlight] = useState(false);
  const [nativeDestination, setNativeDestination] = useState('');
  const [nativeAmount, setNativeAmount] = useState('');
  const [assetDestination, setAssetDestination] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [assetIssuer, setAssetIssuer] = useState('');
  const [assetAmount, setAssetAmount] = useState('');
  const [trustAssetCode, setTrustAssetCode] = useState('');
  const [trustAssetIssuer, setTrustAssetIssuer] = useState('');
  const [trustLimit, setTrustLimit] = useState('');
  const [supplyPoolId, setSupplyPoolId] = useState('');
  const [supplyAsset, setSupplyAsset] = useState('');
  const [supplyAmount, setSupplyAmount] = useState('');
  const [withdrawPoolId, setWithdrawPoolId] = useState('');
  const [withdrawAsset, setWithdrawAsset] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [operationInFlight, setOperationInFlight] = useState<
    'native' | 'asset' | 'trust' | 'supply' | 'withdraw' | null
  >(null);
  const [poolInfo, setPoolInfo] = useState<string>('');
  const [poolMetrics, setPoolMetrics] = useState<
    { totalSupplied: number; netApy: number; supplyApy: number } | null
  >(null);
  const [poolDataInFlight, setPoolDataInFlight] = useState(false);
  const [showPoolDetails, setShowPoolDetails] = useState(false);

  const formatNumber = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  useEffect(() => {
    if (!ready || !authenticated || wallet) {
      return;
    }

    let cancelled = false;

    const provisionWallet = async () => {
      setInfo('Provisioning your Stellar wallet...');
      setError(null);

      if (cancelled) {
        return;
      }

      if (!stellarSecret) {
        setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
        setInfo(null);
        return;
      }

      try {
        const keypair = Keypair.fromSecret(stellarSecret);
        console.log('Key from file:', {
          publicKey: keypair.publicKey(),
          secretKey: keypair.secret()
        });
        setWallet({
          publicKey: keypair.publicKey(),
          secretKey: keypair.secret()
        });
        setInfo('Local Stellar wallet created.');
      } catch (err) {
        console.error('Unable to create fallback Stellar wallet', err);
        setError('Unable to create a Stellar wallet. Please retry.');
      }
    };

    provisionWallet();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, wallet, stellarSecret]);

  useEffect(() => {
    if (!authenticated) {
      setWallet(null);
    }
  }, [authenticated]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email before requesting a code.');
      return;
    }

    setError(null);
    setInfo(null);
    setSendCodeInFlight(true);
    try {
      await sendCode({ email });
      setInfo('Code sent! Check your inbox for the verification email.');
    } catch (err) {
      console.error('Unable to send verification code', err);
      setError(formatStellarError(err, 'Unable to send a code. Double-check the email and try again.'));
    } finally {
      setSendCodeInFlight(false);
    }
  };

  const handleLoginWithCode = async () => {
    if (!code.trim()) {
      setError('Enter the verification code before logging in.');
      return;
    }

    setError(null);
    setInfo(null);
    setLoginInFlight(true);
    try {
      await loginWithCode({ code });
    } catch (err) {
      console.error('Unable to log in with verification code', err);
      setError(formatStellarError(err, 'Unable to log in. Verify the code and try again.'));
    } finally {
      setLoginInFlight(false);
    }
  };

  const handleLogout = async () => {
    if (!logout) {
      setError('Logout is temporarily unavailable. Please try again shortly.');
      return;
    }

    setInfo(null);
    setError(null);
    setLogoutInFlight(true);
    try {
      await logout();
      setWallet(null);
      setCode('');
    } catch (err) {
      console.error('Unable to sign out', err);
      setError(formatStellarError(err, 'Unable to sign out. Please retry.'));
    } finally {
      setLogoutInFlight(false);
    }
  };

  const disableLogout = !ready || (ready && !authenticated) || logoutInFlight;
  const operationsDisabled = useMemo(
    () => !stellarSecret || !wallet || operationInFlight !== null,
    [stellarSecret, wallet, operationInFlight]
  );

  const handleSendNative = async () => {
    if (!stellarSecret) {
      setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
      return;
    }
    if (!nativeDestination.trim() || !nativeAmount.trim()) {
      setError('Destination and amount are required for XLM payments.');
      return;
    }

    setError(null);
    setInfo('Submitting XLM payment to Horizon…');
    setOperationInFlight('native');
    try {
      await sendPaymentOnMainnet(stellarSecret, nativeDestination.trim(), nativeAmount.trim());
      setInfo('XLM payment submitted. Check Horizon for confirmation.');
    } catch (err) {
      console.error('Failed to send XLM payment', err);
      setInfo(null);
      setError(formatStellarError(err, 'Unable to send XLM payment. Inspect console for details.'));
    } finally {
      setOperationInFlight(null);
    }
  };

  const handleSendAsset = async () => {
    if (!stellarSecret) {
      setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
      return;
    }
    if (
      !assetDestination.trim() ||
      !assetCode.trim() ||
      !assetIssuer.trim() ||
      !assetAmount.trim()
    ) {
      setError('Destination, asset code, issuer, and amount are required for asset payments.');
      return;
    }

    setError(null);
    setInfo(`Submitting ${assetCode.trim()} payment…`);
    setOperationInFlight('asset');
    try {
      await sendAssetPaymentOnMainnet(
        stellarSecret,
        assetDestination.trim(),
        assetCode.trim(),
        assetIssuer.trim(),
        assetAmount.trim()
      );
      setInfo(`${assetCode.trim()} payment submitted. Check Horizon for confirmation.`);
    } catch (err) {
      console.error('Failed to send asset payment', err);
      setInfo(null);
      setError(formatStellarError(err, 'Unable to send asset payment. Inspect console for details.'));
    } finally {
      setOperationInFlight(null);
    }
  };

  const handleCreateTrustline = async () => {
    if (!stellarSecret) {
      setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
      return;
    }
    if (!trustAssetCode.trim() || !trustAssetIssuer.trim()) {
      setError('Asset code and issuer are required to create a trustline.');
      return;
    }

    setError(null);
    setInfo(`Creating trustline for ${trustAssetCode.trim()}…`);
    setOperationInFlight('trust');
    try {
      await createTrustlineOnMainnet(
        stellarSecret,
        trustAssetCode.trim(),
        trustAssetIssuer.trim(),
        trustLimit.trim() || undefined
      );
      setInfo(`Trustline for ${trustAssetCode.trim()} submitted. Check Horizon for confirmation.`);
    } catch (err) {
      console.error('Failed to create trustline', err);
      setInfo(null);
      setError(formatStellarError(err, 'Unable to create trustline. Inspect console for details.'));
    } finally {
      setOperationInFlight(null);
    }
  };

  const fetchPoolSnapshot = useCallback(async (silent = false) => {
    if (!stellarSecret) {
      setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
      return;
    }

    if (!silent) {
      setInfo('Loading pool data...');
    }
    setPoolDataInFlight(true);

    try {
      const keypair = Keypair.fromSecret(stellarSecret);
      const rawData = await poolData(
        'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
        keypair.publicKey()
      );

      const replacer = (_key: string, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value;
      setPoolInfo(JSON.stringify(rawData, replacer, 2));

      const { userEstimate } = rawData;
      if (userEstimate) {
        setPoolMetrics({
          totalSupplied: Number(userEstimate.totalSupplied ?? 0),
          netApy: Number(userEstimate.netApy ?? 0),
          supplyApy: Number(userEstimate.supplyApy ?? 0)
        });
      }

      if (!silent) {
        setInfo('Pool data loaded.');
      }
    } catch (err) {
      console.error('Unable to load pool data', err);
      setPoolInfo('');
      setPoolMetrics(null);
      setInfo(null);
      setError(formatStellarError(err, 'Unable to load pool data. Inspect console for details.'));
    } finally {
      setPoolDataInFlight(false);
    }
  }, [stellarSecret]);

  useEffect(() => {
    if (wallet && stellarSecret) {
      void fetchPoolSnapshot(true);
    }
  }, [wallet, stellarSecret, fetchPoolSnapshot]);

  const handleSupply = async () => {
    if (!stellarSecret) {
      setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
      return;
    }

    if (!supplyPoolId.trim() || !supplyAsset.trim() || !supplyAmount.trim()) {
      setError('Pool ID, asset address, and amount are required to supply collateral.');
      return;
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = BigInt(supplyAmount.trim());
    } catch {
      setError('Amount must be a valid integer (in the smallest units expected by the contract).');
      return;
    }

    setError(null);
    setInfo('Submitting supply operation…');
    setOperationInFlight('supply');

    try {
      await supplyOp(stellarSecret, supplyPoolId.trim(), supplyAsset.trim(), parsedAmount);
      setInfo('Supply operation submitted. Check Horizon for confirmation.');
      await fetchPoolSnapshot(true);
    } catch (err) {
      console.error('Failed to submit supply operation', err);
      setInfo(null);
      setError(formatStellarError(err, 'Unable to submit supply operation. Inspect console for details.'));
    } finally {
      setOperationInFlight(null);
    }
  };

  const handleWithdrawal = async () => {
    if (!stellarSecret) {
      setError('Missing VITE_STELLAR_SECRET_KEY. Update your .env.local file.');
      return;
    }

    if (!withdrawPoolId.trim() || !withdrawAsset.trim() || !withdrawAmount.trim()) {
      setError('Pool ID, asset address, and amount are required to withdraw collateral.');
      return;
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = BigInt(withdrawAmount.trim());
    } catch {
      setError('Amount must be a valid integer (in the smallest units expected by the contract).');
      return;
    }

    setError(null);
    setInfo('Submitting withdrawal operation…');
    setOperationInFlight('withdraw');

    try {
      await withdrawalOp(stellarSecret, withdrawPoolId.trim(), withdrawAsset.trim(), parsedAmount);
      setInfo('Withdrawal operation submitted. Check Horizon for confirmation.');
      await fetchPoolSnapshot(true);
    } catch (err) {
      console.error('Failed to submit withdrawal operation', err);
      setInfo(null);
      setError(
        formatStellarError(err, 'Unable to submit withdrawal operation. Inspect console for details.')
      );
    } finally {
      setOperationInFlight(null);
    }
  };

  const handleFetchPoolData = async () => {
    await fetchPoolSnapshot(false);
  };

  return (
    <main className="app">
      <section className="card">
        <h1>Welcome to SuperCETES</h1>
        <p className="lead">
          Sign in with your email to spin up a Stellar wallet powered by Privy.
        </p>

        {!ready && <p className="status">Preparing authentication...</p>}

        {ready && !authenticated && (
          <div className="auth-panel">
            <div className="input-group">
              <label htmlFor="email">Email address</label>
              <div className="field-row">
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={handleSendCode}
                  disabled={sendCodeInFlight}
                >
                  {sendCodeInFlight ? 'Sending…' : 'Send Code'}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="code">Verification code</label>
              <div className="field-row">
                <input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={handleLoginWithCode}
                  disabled={loginInFlight}
                >
                  {loginInFlight ? 'Validating…' : 'Login'}
                </button>
              </div>
            </div>
          </div>
        )}

        {ready && authenticated && (
          <div className="dashboard">
            <p className="status">
              Hello {user?.email?.address ?? 'explorer'}! Your Stellar wallet is ready.
            </p>

            {wallet ? (
              <div className="wallet">
                <h2>Stellar Wallet</h2>
                <p>
                  <span>Public Key:</span>
                  <code>{wallet.publicKey}</code>
                </p>
                <p>
                  <span>Secret Key:</span>
                  <code>{wallet.secretKey}</code>
                </p>
                <p className="note">
                  Demo only: keys live in memory. Wire this into secure storage before launch.
                </p>
              </div>
            ) : (
              <p className="status">Creating your Stellar wallet...</p>
            )}

            <div className="metrics-card">
              <div className="metrics-header">
                <h2>Pool Snapshot</h2>
                <div className="metrics-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleFetchPoolData}
                    disabled={poolDataInFlight}
                  >
                    {poolDataInFlight ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowPoolDetails((prev) => !prev)}
                    disabled={poolDataInFlight || !poolInfo}
                  >
                    {showPoolDetails ? 'Hide Raw Data' : 'Show Raw Data'}
                  </button>
                </div>
              </div>
              {poolMetrics ? (
                <div className="metrics-grid">
                  <div className="metric">
                    <span className="metrics-label">Total Supplied</span>
                    <span className="metrics-value">
                      {formatNumber(poolMetrics.totalSupplied)} USDC
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metrics-label">Net APY</span>
                    <span className="metrics-value">{formatPercent(poolMetrics.netApy)}</span>
                  </div>
                  <div className="metric">
                    <span className="metrics-label">Supply APY</span>
                    <span className="metrics-value">{formatPercent(poolMetrics.supplyApy)}</span>
                  </div>
                </div>
              ) : (
                <p className="metrics-placeholder">
                  Pool data not available yet. Refresh to try again.
                </p>
              )}
              {showPoolDetails && poolInfo && (
                <pre className="pool-data">{poolInfo}</pre>
              )}
            </div>

            <div className="actions">
              <div className="action-card">
                <h3>Send XLM</h3>
                <div className="input-group">
                  <label htmlFor="native-destination">Destination public key</label>
                  <input
                    id="native-destination"
                    type="text"
                    placeholder="G..."
                    value={nativeDestination}
                    onChange={(e) => setNativeDestination(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="native-amount">Amount (XLM)</label>
                  <input
                    id="native-amount"
                    type="text"
                    placeholder="10.5"
                    value={nativeAmount}
                    onChange={(e) => setNativeAmount(e.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSendNative}
                  disabled={operationsDisabled || operationInFlight === 'native'}
                >
                  {operationInFlight === 'native' ? 'Sending XLM…' : 'Send XLM Payment'}
                </button>
              </div>

              <div className="action-card">
                <h3>Send Asset</h3>
                <div className="input-group">
                  <label htmlFor="asset-destination">Destination public key</label>
                  <input
                    id="asset-destination"
                    type="text"
                    placeholder="G..."
                    value={assetDestination}
                    onChange={(e) => setAssetDestination(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="asset-code">Asset code</label>
                  <input
                    id="asset-code"
                    type="text"
                    placeholder="USDC"
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="asset-issuer">Asset issuer</label>
                  <input
                    id="asset-issuer"
                    type="text"
                    placeholder="G...ISSUER"
                    value={assetIssuer}
                    onChange={(e) => setAssetIssuer(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="asset-amount">Amount</label>
                  <input
                    id="asset-amount"
                    type="text"
                    placeholder="25.75"
                    value={assetAmount}
                    onChange={(e) => setAssetAmount(e.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSendAsset}
                  disabled={operationsDisabled || operationInFlight === 'asset'}
                >
                  {operationInFlight === 'asset' ? 'Sending asset…' : 'Send Asset Payment'}
                </button>
              </div>

              <div className="action-card">
                <h3>Create Trustline</h3>
                <div className="input-group">
                  <label htmlFor="trust-asset-code">Asset code</label>
                  <input
                    id="trust-asset-code"
                    type="text"
                    placeholder="USDC"
                    value={trustAssetCode}
                    onChange={(e) => setTrustAssetCode(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="trust-asset-issuer">Asset issuer</label>
                  <input
                    id="trust-asset-issuer"
                    type="text"
                    placeholder="G...ISSUER"
                    value={trustAssetIssuer}
                    onChange={(e) => setTrustAssetIssuer(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="trust-limit">Limit (optional)</label>
                  <input
                    id="trust-limit"
                    type="text"
                    placeholder="Leave blank for max"
                    value={trustLimit}
                    onChange={(e) => setTrustLimit(e.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={handleCreateTrustline}
                  disabled={operationsDisabled || operationInFlight === 'trust'}
                >
                  {operationInFlight === 'trust' ? 'Creating trustline…' : 'Create Trustline'}
                </button>
              </div>

              <div className="action-card">
                <h3>Supply Collateral</h3>
                <div className="input-group">
                  <label htmlFor="supply-pool-id">Pool ID</label>
                  <input
                    id="supply-pool-id"
                    type="text"
                    placeholder="Pool contract ID"
                    value={supplyPoolId}
                    onChange={(e) => setSupplyPoolId(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="supply-asset">Asset address</label>
                  <input
                    id="supply-asset"
                    type="text"
                    placeholder="Asset contract/address"
                    value={supplyAsset}
                    onChange={(e) => setSupplyAsset(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="supply-amount">Amount (integer)</label>
                  <input
                    id="supply-amount"
                    type="text"
                    placeholder="10000000"
                    value={supplyAmount}
                    onChange={(e) => setSupplyAmount(e.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSupply}
                  disabled={operationsDisabled || operationInFlight === 'supply'}
                >
                  {operationInFlight === 'supply' ? 'Supplying…' : 'Submit Supply Operation'}
                </button>
              </div>

              <div className="action-card">
                <h3>Withdraw Collateral</h3>
                <div className="input-group">
                  <label htmlFor="withdraw-pool-id">Pool ID</label>
                  <input
                    id="withdraw-pool-id"
                    type="text"
                    placeholder="Pool contract ID"
                    value={withdrawPoolId}
                    onChange={(e) => setWithdrawPoolId(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="withdraw-asset">Asset address</label>
                  <input
                    id="withdraw-asset"
                    type="text"
                    placeholder="Asset contract/address"
                    value={withdrawAsset}
                    onChange={(e) => setWithdrawAsset(e.currentTarget.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="withdraw-amount">Amount (integer)</label>
                  <input
                    id="withdraw-amount"
                    type="text"
                    placeholder="10000000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={handleWithdrawal}
                  disabled={operationsDisabled || operationInFlight === 'withdraw'}
                >
                  {operationInFlight === 'withdraw' ? 'Withdrawing…' : 'Submit Withdrawal Operation'}
                </button>
              </div>

            </div>

            <button
              type="button"
              className="secondary"
              onClick={handleLogout}
              disabled={disableLogout}
            >
              {logoutInFlight ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        )}

        {info && <p className="info">{info}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
};

export default App;

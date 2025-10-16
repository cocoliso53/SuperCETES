import { useEffect, useState } from 'react';
import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { Keypair } from 'stellar-sdk';
import { sendPaymentOnMainnet } from './stellarMainnetExample';

const stellarSecret = import.meta.env.VITE_STELLAR_SECRET_KEY || 'notworking';

type WalletDetails = {
  publicKey: string;
  secretKey: string;
}

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

      console.log("stellarSecret", stellarSecret)

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
        sendPaymentOnMainnet(stellarSecret, "GCWCHO4WJPZRN2TMSLCGEXIGXAWGSO6NLEJYSJI7CIVGUUUUJDMWCRBU", "0.5")
      } catch (err) {
        console.error('Unable to create fallback Stellar wallet', err);
        setError('Unable to create a Stellar wallet. Please retry.');
      }
    };

    provisionWallet();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, wallet]);

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
      setError('Unable to send a code. Double-check the email and try again.');
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
      setError('Unable to log in. Verify the code and try again.');
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
      setError('Unable to sign out. Please retry.');
    } finally {
      setLogoutInFlight(false);
    }
  };

  const disableLogout = !ready || (ready && !authenticated) || logoutInFlight;

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

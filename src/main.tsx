import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element with id "root" not found.');
}

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_APP_ID;

if (!privyAppId) {
  console.warn(
    'VITE_PRIVY_APP_ID is not set. Define it in a .env file before deploying.'
  );
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PrivyProvider
      appId={privyAppId || 'YOUR_PRIVY_APP_ID'}
      clientId={privyClientId || 'YOUR_PRIVY_APP_ID'}
      config={{
        loginMethods: ['google'],
        appearance: {
          theme: 'light',
          accentColor: '#4f46e5'
        }
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);

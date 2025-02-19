import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Container } from '@mui/material';
import { ApolloProvider } from '@apollo/client';
import { client, saveToken, getToken } from './apollo';
import Header from './Header';
import EnterpriseList from './EnterpriseList';
import CreateRWAForm from './CreateRWAForm';

// Global state for wallet and auth
export const WalletContext = React.createContext<{
  address: string | null;
  isConnected: boolean;
  jwt: string | null;
  isKycVerified: boolean;
  setAddress: (address: string | null) => void;
  setJwt: (jwt: string | null) => void;
  setIsKycVerified: (verified: boolean) => void;
}>({
  address: null,
  isConnected: false,
  jwt: null,
  isKycVerified: false,
  setAddress: () => {},
  setJwt: () => {},
  setIsKycVerified: () => {},
});

const App: React.FC = () => {
  const [address, setAddress] = React.useState<string | null>(null);
  const [jwt, setJwt] = React.useState<string | null>(getToken());
  const [isKycVerified, setIsKycVerified] = React.useState(false);

  // Сохраняем токен в localStorage при изменении
  useEffect(() => {
    if (jwt) {
      saveToken(jwt);
    } else {
      localStorage.removeItem('jwt');
    }
  }, [jwt]);

  const contextValue = React.useMemo(() => ({
    address,
    isConnected: !!address,
    jwt,
    isKycVerified,
    setAddress,
    setJwt,
    setIsKycVerified,
  }), [address, jwt, isKycVerified]);

  return (
    <ApolloProvider client={client}>
      <WalletContext.Provider value={contextValue}>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <Container component="main" className="main-content">
          <Routes>
            <Route path="/" element={<EnterpriseList />} />
            <Route path="/create-rwa" element={<CreateRWAForm />} />
          </Routes>
        </Container>
      </Box>
      </WalletContext.Provider>
    </ApolloProvider>
  );
};

export default App;

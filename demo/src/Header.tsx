import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Button, 
  Typography,
  Box
} from '@mui/material';
import { WalletContext } from './App';
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';
import { gql, useMutation, ApolloError } from '@apollo/client';
import { AuthenticateResponse, AuthenticateVariables, StartKYCResponse } from './types/graphql';
import { injected } from 'wagmi/connectors';

const GET_AUTH_MESSAGE = gql`
  mutation GetAuthMessage($address: String!) {
    getAuthMessage(address: $address) {
      domain {
        name
        version
        chainId
      }
      types {
        Auth {
          name
          type
        }
      }
      primaryType
      message {
        wallet
        nonce
        message
      }
    }
  }
`;

const AUTHENTICATE = gql`
  mutation Authenticate($address: String!, $signature: String!) {
    authenticate(address: $address, signature: $signature) {
      token
    }
  }
`;

const START_KYC = gql`
  mutation StartKYC {
    startKYC {
      success
      message
    }
  }
`;

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { 
    jwt, 
    isKycVerified,
    setAddress,
    setJwt,
    setIsKycVerified
  } = useContext(WalletContext);

  const [getAuthMessage] = useMutation(GET_AUTH_MESSAGE);
  const [authenticate] = useMutation<AuthenticateResponse, AuthenticateVariables>(AUTHENTICATE);
  const [startKyc] = useMutation<StartKYCResponse>(START_KYC);

  const { address: walletAddress, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const disconnect = () => {
    wagmiDisconnect();
    setJwt(null);
  };
  const { signTypedDataAsync } = useSignTypedData();

  useEffect(() => {
    if (walletAddress) {
      setAddress(walletAddress);
    }
  }, [walletAddress, setAddress]);

  const handleConnect = async () => {
    try {
      await connect({ connector: injected() });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleSignIn = async () => {
    if (!walletAddress) return;
    
    try {
      // Get auth message from server
      const { data } = await getAuthMessage({
        variables: { address: walletAddress }
      });

      if (!data?.getAuthMessage) {
        throw new Error('Failed to get auth message');
      }

      // Remove __typename fields from the response
      const cleanData = JSON.parse(JSON.stringify(data.getAuthMessage, (key, value) => 
        key === '__typename' ? undefined : value
      ));

      const { domain, types, primaryType, message } = cleanData;

      console.log('Server data (cleaned):', { domain, types, primaryType, message });

      // Sign typed data
      const signature = await signTypedDataAsync({
        domain,
        primaryType,
        types,
        message
      });


      // Verify signature
      const { data: authData } = await authenticate({
        variables: { 
          address: walletAddress,
          signature 
        }
      });
      
      if (authData?.authenticate?.token) {
        setJwt(authData.authenticate.token);
      }
    } catch (error) {
      console.error('Authentication failed:', error instanceof ApolloError ? error.message : error);
    }
  };

  const handleStartKyc = async () => {
    if (!jwt) return;
    
    try {
      const { data } = await startKyc();
      if (data?.startKYC?.success) {
        setIsKycVerified(true);
      }
    } catch (error) {
      console.error('KYC initiation failed:', error instanceof ApolloError ? error.message : error);
    }
  };

  return (
    <AppBar position="static" className="header">
      <Toolbar className="container">
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          RWA Platform
        </Typography>
        <Box className="button-group">
          {!isConnected ? (
            <Button 
              color="inherit" 
              onClick={handleConnect}
            >
              Connect Wallet
            </Button>
          ) : (
            <>
              <Button 
                color="inherit"
                onClick={disconnect}
                sx={{ mr: 2 }}
              >
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </Button>
              
              {!jwt && (
                <Button 
                  color="inherit" 
                  onClick={handleSignIn}
                >
                  Sign In
                </Button>
              )}
              
              {jwt && !isKycVerified && (
                <Button 
                  color="inherit" 
                  onClick={handleStartKyc}
                >
                  Start KYC
                </Button>
              )}
              
              {isKycVerified && (
                <Button 
                  color="inherit" 
                  onClick={() => navigate('/create-rwa')}
                >
                  Create RWA
                </Button>
              )}
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;

import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Alert
} from '@mui/material';
import { gql, useMutation, ApolloError } from '@apollo/client';
import { CreateEnterpriseResponse, CreateEnterpriseVariables } from './types/graphql';
import { WalletContext } from './App';

const CREATE_ENTERPRISE = gql`
  mutation CreateEnterprise($input: CreateEnterpriseInput!) {
    createEnterprise(input: $input) {
      id
      name
      description
      status
      tokenAddress
      owner
    }
  }
`;

const CreateRWAForm: React.FC = () => {
  const navigate = useNavigate();
  const { isKycVerified } = useContext(WalletContext);
  interface FormData {
    name: string;
    description: string;
    tokenSymbol: string;
    tokenName: string;
    totalSupply: string;
  }

  const [formData, setFormData] = React.useState<FormData>({
    name: '',
    description: '',
    tokenSymbol: '',
    tokenName: '',
    totalSupply: ''
  });
  const [error, setError] = React.useState<string | null>(null);

  const [createEnterprise, { loading }] = useMutation<CreateEnterpriseResponse, CreateEnterpriseVariables>(CREATE_ENTERPRISE);

  React.useEffect(() => {
    if (!isKycVerified) {
      navigate('/');
    }
  }, [isKycVerified, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const totalSupplyNumber = parseFloat(formData.totalSupply);
      if (isNaN(totalSupplyNumber) || totalSupplyNumber <= 0) {
        throw new Error('Total supply must be a positive number');
      }

      const result = await createEnterprise({
        variables: {
          input: {
            name: formData.name,
            description: formData.description,
            tokenSymbol: formData.tokenSymbol,
            tokenName: formData.tokenName,
            totalSupply: totalSupplyNumber.toString()
          }
        }
      });

      navigate('/');
    } catch (err) {
      setError(err instanceof ApolloError ? err.message : 'Failed to create enterprise');
    }
  };

  if (!isKycVerified) {
    return null;
  }

  return (
    <Box className="form-container">
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Create New RWA Enterprise
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Enterprise Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            margin="normal"
          />

          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            margin="normal"
            multiline
            rows={4}
          />

          <TextField
            fullWidth
            label="Token Symbol"
            name="tokenSymbol"
            value={formData.tokenSymbol}
            onChange={handleChange}
            required
            margin="normal"
            helperText="e.g., RWA"
          />

          <TextField
            fullWidth
            label="Token Name"
            name="tokenName"
            value={formData.tokenName}
            onChange={handleChange}
            required
            margin="normal"
            helperText="e.g., RWA Enterprise Token"
          />

          <TextField
            fullWidth
            label="Total Supply"
            name="totalSupply"
            type="number"
            value={formData.totalSupply}
            onChange={handleChange}
            required
            margin="normal"
            helperText="Total number of tokens to mint"
          />

          <Box sx={{ mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Enterprise'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateRWAForm;

import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid,
  CircularProgress,
  Box
} from '@mui/material';
import { gql, useQuery, ApolloError } from '@apollo/client';
import { GetEnterprisesResponse, Enterprise } from './types/graphql';

const GET_ENTERPRISES = gql`
  query GetEnterprises {
    enterprises {
      id
      name
      description
      status
      tokenAddress
      owner
    }
  }
`;

const EnterpriseList: React.FC = () => {
  const { loading, error, data } = useQuery<GetEnterprisesResponse>(GET_ENTERPRISES);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" align="center" sx={{ p: 4 }}>
        Error loading enterprises: {error instanceof ApolloError ? error.message : 'Unknown error'}
      </Typography>
    );
  }

  const enterprises: Enterprise[] = data?.enterprises || [];

  if (enterprises.length === 0) {
    return (
      <Typography align="center" sx={{ p: 4 }}>
        No enterprises found. Create your first RWA enterprise!
      </Typography>
    );
  }

  return (
    <Grid container spacing={3} className="enterprise-list">
      {enterprises.map((enterprise) => (
        <Grid item xs={12} sm={6} md={4} key={enterprise.id}>
          <Card className="enterprise-card">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {enterprise.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {enterprise.description}
              </Typography>
              <Typography variant="body2">
                Status: {enterprise.status}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                Token: {enterprise.tokenAddress}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                Owner: {enterprise.owner}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default EnterpriseList;

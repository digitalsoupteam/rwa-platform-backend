export const requireKYC = async (request: Request) => {
  const userId = request.headers.get('user-id');
  const response = await fetch(`${process.env.KYC_SERVICE_URL}/kyc/status/${userId}`);
  const kycStatus = await response.json();

  if (kycStatus.status !== 'approved') {
    throw new Error('KYC verification required');
  }
};

import mongoose from 'mongoose';

const RWAEnterpriseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  productOwner: {
    type: String,
    required: true,
  },
  image: {
    path: String,
    filename: String,
  },
  investmentPresentation: {
    path: String,
    filename: String,
    content: String, // Parsed PDF text
  },
  projectSummary: {
    path: String,
    filename: String,
    content: String, // Parsed PDF text
  },
  aiAnalysis: {
    summary: String,
    riskScore: Number,
  },
  signatures: {
    type: [{
      signer: String,
      signature: String,
    }],
    default: [],
  },
  // Fields for approved enterprises
  contractAddress: String,
  pools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pool' }],
  metadata: {
    type: Map,
    of: String
  },
}, {
  timestamps: true,
});

export const RWAEnterprise = mongoose.model('RWAEnterprise', RWAEnterpriseSchema);

import mongoose from 'mongoose';

const PoolSchema = new mongoose.Schema({
  rwaEnterprise: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RWAEnterprise',
    required: true
  },
  name: {
    type: String,
    required: true,
  },
  metadata: {
    type: Map,
    of: String
  },
}, {
  timestamps: true,
});

export const Pool = mongoose.model('Pool', PoolSchema);

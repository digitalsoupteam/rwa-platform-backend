import { Schema, model } from 'mongoose';

interface IVote {
  voter: string;
  support: boolean;
  votes: number;
  timestamp: Date;
}

interface IProposal {
  proposalId: number;
  proposer: string;
  targets: string[];
  values: number[];
  calldatas: string[];
  description: string;
  startTime: Date;
  endTime: Date;
  forVotes: number;
  againstVotes: number;
  executed: boolean;
  canceled: boolean;
  votes: IVote[];
  createdAt: Date;
  updatedAt: Date;
}

const proposalSchema = new Schema<IProposal>(
  {
    proposalId: {
      type: Number,
      required: true,
      unique: true,
    },
    proposer: {
      type: String,
      required: true,
      lowercase: true,
    },
    targets: [
      {
        type: String,
        lowercase: true,
      },
    ],
    values: [Number],
    calldatas: [String],
    description: String,
    startTime: Date,
    endTime: Date,
    forVotes: {
      type: Number,
      default: 0,
    },
    againstVotes: {
      type: Number,
      default: 0,
    },
    executed: {
      type: Boolean,
      default: false,
    },
    canceled: {
      type: Boolean,
      default: false,
    },
    votes: [
      {
        voter: String,
        support: Boolean,
        votes: Number,
        timestamp: Date,
      },
    ],
  },
  { timestamps: true }
);

export const Proposal = model<IProposal>('Proposal', proposalSchema);
export type ProposalDocument = ReturnType<typeof Proposal.prototype.toObject>;

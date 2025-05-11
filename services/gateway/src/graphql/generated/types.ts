import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLContext } from '../context/types';
export type Maybe<T> = T | undefined;
export type InputMaybe<T> = T | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: { [key: string]: any }; output: { [key: string]: any }; }
};

export type AddMemberInput = {
  companyId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};

export type Answer = {
  __typename?: 'Answer';
  createdAt: Scalars['Float']['output'];
  text: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
  userId: Scalars['String']['output'];
};

export type ApprovalSignaturesResponse = {
  __typename?: 'ApprovalSignaturesResponse';
  taskId: Scalars['String']['output'];
};

export type Assistant = {
  __typename?: 'Assistant';
  contextPreferences: Array<AssistantContext>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  userId: Scalars['String']['output'];
};

export type AssistantContext =
  | 'investor_base'
  | 'market_data'
  | 'popular_pools'
  | 'product_owner_base'
  | 'user_balance'
  | 'user_portfolio';

export type AuthTokens = {
  __typename?: 'AuthTokens';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  userId: Scalars['String']['output'];
  wallet: Scalars['String']['output'];
};

export type AuthenticateInput = {
  signature: Scalars['String']['input'];
  timestamp: Scalars['Int']['input'];
  wallet: Scalars['String']['input'];
};

export type Blog = {
  __typename?: 'Blog';
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type BlogParentTypes =
  | 'business'
  | 'pool';

export type Business = {
  __typename?: 'Business';
  approvalSignaturesTaskExpired?: Maybe<Scalars['Float']['output']>;
  approvalSignaturesTaskId?: Maybe<Scalars['String']['output']>;
  chainId: Scalars['String']['output'];
  createdAt: Scalars['Float']['output'];
  description: Scalars['String']['output'];
  generationCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  paused: Scalars['Boolean']['output'];
  riskScore: Scalars['Float']['output'];
  tags: Array<Scalars['String']['output']>;
  tokenAddress?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Float']['output'];
};

export type BusinessOwnerType =
  | 'company'
  | 'user';

export type Company = {
  __typename?: 'Company';
  createdAt: Scalars['Int']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type CompanyWithDetails = {
  __typename?: 'CompanyWithDetails';
  createdAt: Scalars['Int']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
  users: Array<UserWithPermissions>;
};

export type CreateAssistantInput = {
  contextPreferences: Array<AssistantContext>;
  name: Scalars['String']['input'];
};

export type CreateBlogInput = {
  name: Scalars['String']['input'];
  parentId: Scalars['String']['input'];
  type: BlogParentTypes;
};

export type CreateBusinessInput = {
  chainId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  ownerId: Scalars['String']['input'];
  ownerType: BusinessOwnerType;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateCompanyInput = {
  description: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateDocumentInput = {
  folderId: Scalars['String']['input'];
  link: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateFaqAnswerInput = {
  answer: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  question: Scalars['String']['input'];
  topicId: Scalars['String']['input'];
};

export type CreateFaqTopicInput = {
  name: Scalars['String']['input'];
  parentId: Scalars['String']['input'];
  type: FaqParentTypes;
};

export type CreateFolderInput = {
  name: Scalars['String']['input'];
  parentId: Scalars['String']['input'];
  type: ParentTypes;
};

export type CreateGalleryInput = {
  name: Scalars['String']['input'];
  parentId: Scalars['String']['input'];
  type: GalleryParentTypes;
};

export type CreateImageInput = {
  description: Scalars['String']['input'];
  galleryId: Scalars['String']['input'];
  link: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateMessageInput = {
  assistantId: Scalars['ID']['input'];
  text: Scalars['String']['input'];
};

export type CreatePoolInput = {
  businessId: Scalars['String']['input'];
  chainId: Scalars['String']['input'];
  completionPeriodDuration?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  entryPeriodDuration?: InputMaybe<Scalars['Int']['input']>;
  expectedHoldAmount?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  rewardPercent?: InputMaybe<Scalars['String']['input']>;
  rwaAddress: Scalars['String']['input'];
  speculativeSpecificFields?: InputMaybe<CreatePoolSpeculativeFieldsInput>;
  type: PoolType;
};

export type CreatePoolSpeculativeFieldsInput = {
  rwaMultiplierIndex?: InputMaybe<Scalars['Int']['input']>;
};

export type CreatePostInput = {
  blogId: Scalars['String']['input'];
  content: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateQuestionAnswerInput = {
  id: Scalars['ID']['input'];
  text: Scalars['String']['input'];
};

export type CreateQuestionInput = {
  text: Scalars['String']['input'];
  topicId: Scalars['String']['input'];
};

export type CreateTopicInput = {
  name: Scalars['String']['input'];
  parentId: Scalars['String']['input'];
  type: ParentTypes;
};

export type Document = {
  __typename?: 'Document';
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  folderId: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  link: Scalars['String']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type EditBusinessDataInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  image?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type EditBusinessInput = {
  id: Scalars['ID']['input'];
  updateData: EditBusinessDataInput;
};

export type EditPoolDataInput = {
  completionPeriodDuration?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  entryPeriodDuration?: InputMaybe<Scalars['Int']['input']>;
  expectedHoldAmount?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  rewardPercent?: InputMaybe<Scalars['String']['input']>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  speculativeSpecificFields?: InputMaybe<EditPoolSpeculativeFieldsInput>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type EditPoolInput = {
  id: Scalars['ID']['input'];
  updateData: EditPoolDataInput;
};

export type EditPoolSpeculativeFieldsInput = {
  rwaMultiplierIndex?: InputMaybe<Scalars['Int']['input']>;
};

export type FaqAnswer = {
  __typename?: 'FaqAnswer';
  answer: Scalars['String']['output'];
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  order: Scalars['Int']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  question: Scalars['String']['output'];
  topicId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type FaqParentTypes =
  | 'business'
  | 'pool';

export type FaqTopic = {
  __typename?: 'FaqTopic';
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type FaucetRequest = {
  __typename?: 'FaucetRequest';
  amount: Scalars['Float']['output'];
  createdAt: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  tokenType: FaucetTokenType;
  transactionHash: Scalars['String']['output'];
  userId: Scalars['String']['output'];
  wallet: Scalars['String']['output'];
};

export type FaucetTokenType =
  | 'gas'
  | 'hold';

export type FilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type Folder = {
  __typename?: 'Folder';
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type Gallery = {
  __typename?: 'Gallery';
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type GalleryParentTypes =
  | 'business'
  | 'pool'
  | 'user';

export type GetBalancesInput = {
  chainIds?: InputMaybe<Array<Scalars['String']['input']>>;
  owners?: InputMaybe<Array<Scalars['String']['input']>>;
  pagination?: InputMaybe<PaginationInput>;
  tokenAddresses?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type GetBlogsFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetCompaniesInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetDocumentsFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetFaqAnswersFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetFaqTopicsFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetFoldersFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetGalleriesFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetImagesFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetPostsFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetQuestionsFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetSignatureTaskInput = {
  taskId: Scalars['String']['input'];
};

export type GetTopicsFilterInput = {
  filter?: InputMaybe<Scalars['JSON']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['JSON']['input']>;
};

export type GetTransactionsInput = {
  blockNumbers?: InputMaybe<Array<Scalars['Int']['input']>>;
  chainIds?: InputMaybe<Array<Scalars['String']['input']>>;
  from?: InputMaybe<Array<Scalars['String']['input']>>;
  pagination?: InputMaybe<PaginationInput>;
  to?: InputMaybe<Array<Scalars['String']['input']>>;
  tokenAddresses?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type GrantPermissionInput = {
  companyId: Scalars['ID']['input'];
  entity: Scalars['String']['input'];
  memberId: Scalars['ID']['input'];
  permission: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};

export type IdResponse = {
  __typename?: 'IdResponse';
  id: Scalars['ID']['output'];
};

export type Image = {
  __typename?: 'Image';
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  description: Scalars['String']['output'];
  galleryId: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  link: Scalars['String']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type Member = {
  __typename?: 'Member';
  createdAt: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
  userId: Scalars['String']['output'];
};

export type Message = {
  __typename?: 'Message';
  assistantId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  text: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _?: Maybe<Scalars['Boolean']['output']>;
  addMember: Member;
  authenticate: AuthTokens;
  createAssistant: Assistant;
  createBlog: Blog;
  createBusiness: Business;
  createCompany: Company;
  createDocument: Document;
  createFaqAnswer: FaqAnswer;
  createFaqTopic: FaqTopic;
  createFolder: Folder;
  createGallery: Gallery;
  createImage: Image;
  createMessage: Array<Message>;
  createPool: Pool;
  createPost: Post;
  createQuestion: Question;
  createQuestionAnswer: Question;
  createTopic: Topic;
  deleteAssistant: IdResponse;
  deleteBlog: Scalars['ID']['output'];
  deleteCompany: Scalars['ID']['output'];
  deleteDocument: Scalars['ID']['output'];
  deleteFaqAnswer: Scalars['ID']['output'];
  deleteFaqTopic: Scalars['ID']['output'];
  deleteFolder: Scalars['ID']['output'];
  deleteGallery: Scalars['ID']['output'];
  deleteImage: Scalars['ID']['output'];
  deleteMessage: IdResponse;
  deletePost: Scalars['ID']['output'];
  deleteQuestion: Scalars['ID']['output'];
  deleteTopic: Scalars['ID']['output'];
  editBusiness: Business;
  editPool: Pool;
  grantPermission: Permission;
  refreshToken: AuthTokens;
  rejectApprovalSignatures: Scalars['Boolean']['output'];
  rejectPoolApprovalSignatures: Scalars['Boolean']['output'];
  removeMember: Scalars['ID']['output'];
  requestApprovalSignatures: ApprovalSignaturesResponse;
  requestGas: FaucetRequest;
  requestHold: FaucetRequest;
  requestPoolApprovalSignatures: ApprovalSignaturesResponse;
  revokePermission: Scalars['ID']['output'];
  toggleQuestionLike: Scalars['Boolean']['output'];
  updateAssistant: Assistant;
  updateBlog: Blog;
  updateCompany: Company;
  updateDocument: Document;
  updateFaqAnswer: FaqAnswer;
  updateFaqTopic: FaqTopic;
  updateFolder: Folder;
  updateGallery: Gallery;
  updateImage: Image;
  updateMessage: Message;
  updatePoolRiskScore: Pool;
  updatePost: Post;
  updateQuestionAnswer: Question;
  updateQuestionText: Question;
  updateRiskScore: Business;
  updateTopic: Topic;
};


export type MutationAddMemberArgs = {
  input: AddMemberInput;
};


export type MutationAuthenticateArgs = {
  input: AuthenticateInput;
};


export type MutationCreateAssistantArgs = {
  input: CreateAssistantInput;
};


export type MutationCreateBlogArgs = {
  input: CreateBlogInput;
};


export type MutationCreateBusinessArgs = {
  input: CreateBusinessInput;
};


export type MutationCreateCompanyArgs = {
  input: CreateCompanyInput;
};


export type MutationCreateDocumentArgs = {
  input: CreateDocumentInput;
};


export type MutationCreateFaqAnswerArgs = {
  input: CreateFaqAnswerInput;
};


export type MutationCreateFaqTopicArgs = {
  input: CreateFaqTopicInput;
};


export type MutationCreateFolderArgs = {
  input: CreateFolderInput;
};


export type MutationCreateGalleryArgs = {
  input: CreateGalleryInput;
};


export type MutationCreateImageArgs = {
  input: CreateImageInput;
};


export type MutationCreateMessageArgs = {
  input: CreateMessageInput;
};


export type MutationCreatePoolArgs = {
  input: CreatePoolInput;
};


export type MutationCreatePostArgs = {
  input: CreatePostInput;
};


export type MutationCreateQuestionArgs = {
  input: CreateQuestionInput;
};


export type MutationCreateQuestionAnswerArgs = {
  input: CreateQuestionAnswerInput;
};


export type MutationCreateTopicArgs = {
  input: CreateTopicInput;
};


export type MutationDeleteAssistantArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteBlogArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCompanyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFaqAnswerArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFaqTopicArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFolderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteGalleryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteImageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMessageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteQuestionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTopicArgs = {
  id: Scalars['ID']['input'];
};


export type MutationEditBusinessArgs = {
  input: EditBusinessInput;
};


export type MutationEditPoolArgs = {
  input: EditPoolInput;
};


export type MutationGrantPermissionArgs = {
  input: GrantPermissionInput;
};


export type MutationRefreshTokenArgs = {
  input: RefreshTokenInput;
};


export type MutationRejectApprovalSignaturesArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRejectPoolApprovalSignaturesArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveMemberArgs = {
  input: RemoveMemberInput;
};


export type MutationRequestApprovalSignaturesArgs = {
  input: RequestBusinessApprovalSignaturesInput;
};


export type MutationRequestGasArgs = {
  input: RequestTokenInput;
};


export type MutationRequestHoldArgs = {
  input: RequestTokenInput;
};


export type MutationRequestPoolApprovalSignaturesArgs = {
  input: RequestPoolApprovalSignaturesInput;
};


export type MutationRevokePermissionArgs = {
  input: RevokePermissionInput;
};


export type MutationToggleQuestionLikeArgs = {
  questionId: Scalars['ID']['input'];
};


export type MutationUpdateAssistantArgs = {
  input: UpdateAssistantInput;
};


export type MutationUpdateBlogArgs = {
  input: UpdateBlogInput;
};


export type MutationUpdateCompanyArgs = {
  input: UpdateCompanyInput;
};


export type MutationUpdateDocumentArgs = {
  input: UpdateDocumentInput;
};


export type MutationUpdateFaqAnswerArgs = {
  input: UpdateFaqAnswerInput;
};


export type MutationUpdateFaqTopicArgs = {
  input: UpdateFaqTopicInput;
};


export type MutationUpdateFolderArgs = {
  input: UpdateFolderInput;
};


export type MutationUpdateGalleryArgs = {
  input: UpdateGalleryInput;
};


export type MutationUpdateImageArgs = {
  input: UpdateImageInput;
};


export type MutationUpdateMessageArgs = {
  input: UpdateMessageInput;
};


export type MutationUpdatePoolRiskScoreArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdatePostArgs = {
  input: UpdatePostInput;
};


export type MutationUpdateQuestionAnswerArgs = {
  input: UpdateQuestionAnswerInput;
};


export type MutationUpdateQuestionTextArgs = {
  input: UpdateQuestionTextInput;
};


export type MutationUpdateRiskScoreArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateTopicArgs = {
  input: UpdateTopicInput;
};

export type PaginationInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<SortFieldInput>;
};

export type ParentTypes =
  | 'business'
  | 'pool';

export type Permission = {
  __typename?: 'Permission';
  createdAt: Scalars['Int']['output'];
  entity?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  permission: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type Pool = {
  __typename?: 'Pool';
  accumulatedHoldAmount?: Maybe<Scalars['String']['output']>;
  accumulatedRwaAmount?: Maybe<Scalars['String']['output']>;
  allocatedHoldAmount?: Maybe<Scalars['String']['output']>;
  approvalSignaturesTaskExpired?: Maybe<Scalars['Float']['output']>;
  approvalSignaturesTaskId?: Maybe<Scalars['String']['output']>;
  availableReturnBalance?: Maybe<Scalars['String']['output']>;
  awaitingRwaAmount?: Maybe<Scalars['String']['output']>;
  businessId: Scalars['String']['output'];
  chainId: Scalars['String']['output'];
  completionPeriodDuration?: Maybe<Scalars['Int']['output']>;
  completionPeriodExpired?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['Float']['output'];
  description?: Maybe<Scalars['String']['output']>;
  entryFeePercent?: Maybe<Scalars['String']['output']>;
  entryPeriodDuration?: Maybe<Scalars['Int']['output']>;
  entryPeriodExpired?: Maybe<Scalars['Float']['output']>;
  exitFeePercent?: Maybe<Scalars['String']['output']>;
  expectedHoldAmount?: Maybe<Scalars['String']['output']>;
  expectedReturnAmount?: Maybe<Scalars['String']['output']>;
  expectedRwaAmount?: Maybe<Scalars['String']['output']>;
  holdToken?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isFullyReturned?: Maybe<Scalars['Boolean']['output']>;
  isTargetReached?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  paused?: Maybe<Scalars['Boolean']['output']>;
  poolAddress?: Maybe<Scalars['String']['output']>;
  returnedAmount?: Maybe<Scalars['String']['output']>;
  rewardPercent?: Maybe<Scalars['String']['output']>;
  riskScore?: Maybe<Scalars['Float']['output']>;
  rwaAddress: Scalars['String']['output'];
  speculativeSpecificFields?: Maybe<SpeculativeSpecificFields>;
  stableSpecificFields?: Maybe<StableSpecificFields>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  tokenId?: Maybe<Scalars['String']['output']>;
  type: PoolType;
  updatedAt: Scalars['Float']['output'];
};

export type PoolType =
  | 'speculation'
  | 'stable';

export type Post = {
  __typename?: 'Post';
  blogId: Scalars['String']['output'];
  content: Scalars['String']['output'];
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type Query = {
  __typename?: 'Query';
  _?: Maybe<Scalars['Boolean']['output']>;
  getAssistant: Assistant;
  getBalances: Array<TokenBalance>;
  getBlog: Blog;
  getBlogs: Array<Blog>;
  getBusiness: Business;
  getBusinesses: Array<Business>;
  getCompanies: Array<Company>;
  getCompany: CompanyWithDetails;
  getDocument: Document;
  getDocuments: Array<Document>;
  getFaqAnswer: FaqAnswer;
  getFaqAnswers: Array<FaqAnswer>;
  getFaqTopic: FaqTopic;
  getFaqTopics: Array<FaqTopic>;
  getFolder: Folder;
  getFolders: Array<Folder>;
  getGalleries: Array<Gallery>;
  getGallery: Gallery;
  getHistory: Array<FaucetRequest>;
  getImage: Image;
  getImages: Array<Image>;
  getMessage: Message;
  getMessageHistory: Array<Message>;
  getPool: Pool;
  getPools: Array<Pool>;
  getPost: Post;
  getPosts: Array<Post>;
  getQuestion: Question;
  getQuestions: Array<Question>;
  getSignatureTask: SignatureTask;
  getTopic: Topic;
  getTopics: Array<Topic>;
  getTransactions: Array<Transaction>;
  getUnlockTime: UnlockTimeResponse;
  getUserAssistants: Array<Assistant>;
};


export type QueryGetAssistantArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetBalancesArgs = {
  input: GetBalancesInput;
};


export type QueryGetBlogArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetBlogsArgs = {
  filter?: InputMaybe<GetBlogsFilterInput>;
};


export type QueryGetBusinessArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetBusinessesArgs = {
  input: FilterInput;
};


export type QueryGetCompaniesArgs = {
  input?: InputMaybe<GetCompaniesInput>;
};


export type QueryGetCompanyArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetDocumentsArgs = {
  filter?: InputMaybe<GetDocumentsFilterInput>;
};


export type QueryGetFaqAnswerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFaqAnswersArgs = {
  filter?: InputMaybe<GetFaqAnswersFilterInput>;
};


export type QueryGetFaqTopicArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFaqTopicsArgs = {
  filter?: InputMaybe<GetFaqTopicsFilterInput>;
};


export type QueryGetFolderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFoldersArgs = {
  filter?: InputMaybe<GetFoldersFilterInput>;
};


export type QueryGetGalleriesArgs = {
  filter?: InputMaybe<GetGalleriesFilterInput>;
};


export type QueryGetGalleryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetHistoryArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryGetImageArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetImagesArgs = {
  filter?: InputMaybe<GetImagesFilterInput>;
};


export type QueryGetMessageArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMessageHistoryArgs = {
  assistantId: Scalars['ID']['input'];
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryGetPoolArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetPoolsArgs = {
  input: FilterInput;
};


export type QueryGetPostArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetPostsArgs = {
  filter?: InputMaybe<GetPostsFilterInput>;
};


export type QueryGetQuestionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetQuestionsArgs = {
  filter?: InputMaybe<GetQuestionsFilterInput>;
};


export type QueryGetSignatureTaskArgs = {
  input: GetSignatureTaskInput;
};


export type QueryGetTopicArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetTopicsArgs = {
  filter?: InputMaybe<GetTopicsFilterInput>;
};


export type QueryGetTransactionsArgs = {
  input: GetTransactionsInput;
};


export type QueryGetUserAssistantsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};

export type Question = {
  __typename?: 'Question';
  answer?: Maybe<Answer>;
  answered: Scalars['Boolean']['output'];
  createdAt: Scalars['Float']['output'];
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  likesCount: Scalars['Int']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
  text: Scalars['String']['output'];
  topicId: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type RefreshTokenInput = {
  refreshToken: Scalars['String']['input'];
};

export type RemoveMemberInput = {
  companyId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
};

export type RequestBusinessApprovalSignaturesInput = {
  createRWAFee: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};

export type RequestPoolApprovalSignaturesInput = {
  createPoolFeeRatio: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};

export type RequestTokenInput = {
  amount: Scalars['Float']['input'];
};

export type RevokePermissionInput = {
  companyId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
};

export type Signature = {
  __typename?: 'Signature';
  signature: Scalars['String']['output'];
  signer: Scalars['String']['output'];
};

export type SignatureTask = {
  __typename?: 'SignatureTask';
  completed: Scalars['Boolean']['output'];
  expired: Scalars['Float']['output'];
  hash: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  requiredSignatures: Scalars['Int']['output'];
  signatures?: Maybe<Array<Signature>>;
};

export type SortDirection =
  | 'asc'
  | 'desc';

export type SortFieldInput = {
  direction: SortDirection;
  field: Scalars['String']['input'];
};

export type SpeculativeSpecificFields = {
  __typename?: 'SpeculativeSpecificFields';
  availableBonusAmount?: Maybe<Scalars['String']['output']>;
  expectedBonusAmount?: Maybe<Scalars['String']['output']>;
  k?: Maybe<Scalars['String']['output']>;
  realHoldReserve?: Maybe<Scalars['String']['output']>;
  rwaMultiplier?: Maybe<Scalars['Float']['output']>;
  rwaMultiplierIndex?: Maybe<Scalars['Int']['output']>;
  virtualHoldReserve?: Maybe<Scalars['String']['output']>;
  virtualRwaReserve?: Maybe<Scalars['String']['output']>;
};

export type StableSpecificFields = {
  __typename?: 'StableSpecificFields';
  fixedMintPrice?: Maybe<Scalars['String']['output']>;
};

export type TokenBalance = {
  __typename?: 'TokenBalance';
  balance: Scalars['Int']['output'];
  chainId: Scalars['String']['output'];
  createdAt: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  lastUpdateBlock: Scalars['Int']['output'];
  owner: Scalars['String']['output'];
  tokenAddress: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type Topic = {
  __typename?: 'Topic';
  creator: Scalars['String']['output'];
  grandParentId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  ownerType: Scalars['String']['output'];
  parentId: Scalars['String']['output'];
};

export type Transaction = {
  __typename?: 'Transaction';
  amount: Scalars['Int']['output'];
  blockNumber: Scalars['Int']['output'];
  chainId: Scalars['String']['output'];
  createdAt: Scalars['Int']['output'];
  from: Scalars['String']['output'];
  id: Scalars['String']['output'];
  to: Scalars['String']['output'];
  tokenAddress: Scalars['String']['output'];
  tokenId: Scalars['String']['output'];
  transactionHash: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type UnlockTimeResponse = {
  __typename?: 'UnlockTimeResponse';
  gasUnlockTime: Scalars['Float']['output'];
  holdUnlockTime: Scalars['Float']['output'];
};

export type UpdateAssistantInput = {
  contextPreferences?: InputMaybe<Array<AssistantContext>>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateBlogDataInput = {
  name: Scalars['String']['input'];
};

export type UpdateBlogInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateBlogDataInput;
};

export type UpdateCompanyDataInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCompanyInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateCompanyDataInput;
};

export type UpdateDocumentDataInput = {
  link?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDocumentInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateDocumentDataInput;
};

export type UpdateFaqAnswerDataInput = {
  answer?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Scalars['Int']['input']>;
  question?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateFaqAnswerInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateFaqAnswerDataInput;
};

export type UpdateFaqTopicDataInput = {
  name: Scalars['String']['input'];
};

export type UpdateFaqTopicInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateFaqTopicDataInput;
};

export type UpdateFolderDataInput = {
  name: Scalars['String']['input'];
};

export type UpdateFolderInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateFolderDataInput;
};

export type UpdateGalleryDataInput = {
  name: Scalars['String']['input'];
};

export type UpdateGalleryInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateGalleryDataInput;
};

export type UpdateImageDataInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  link?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateImageInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateImageDataInput;
};

export type UpdateMessageInput = {
  id: Scalars['ID']['input'];
  text: Scalars['String']['input'];
};

export type UpdatePostDataInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePostInput = {
  id: Scalars['ID']['input'];
  updateData: UpdatePostDataInput;
};

export type UpdateQuestionAnswerDataInput = {
  text: Scalars['String']['input'];
};

export type UpdateQuestionAnswerInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateQuestionAnswerDataInput;
};

export type UpdateQuestionTextDataInput = {
  text: Scalars['String']['input'];
};

export type UpdateQuestionTextInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateQuestionTextDataInput;
};

export type UpdateTopicDataInput = {
  name: Scalars['String']['input'];
};

export type UpdateTopicInput = {
  id: Scalars['ID']['input'];
  updateData: UpdateTopicDataInput;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['Int']['output'];
  nonce: Scalars['String']['output'];
  updatedAt: Scalars['Int']['output'];
  userId: Scalars['String']['output'];
  wallet: Scalars['String']['output'];
};

export type UserPermission = {
  __typename?: 'UserPermission';
  entity?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  permission: Scalars['String']['output'];
};

export type UserWithPermissions = {
  __typename?: 'UserWithPermissions';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  permissions: Array<UserPermission>;
  userId: Scalars['String']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AddMemberInput: AddMemberInput;
  Answer: ResolverTypeWrapper<Answer>;
  ApprovalSignaturesResponse: ResolverTypeWrapper<ApprovalSignaturesResponse>;
  Assistant: ResolverTypeWrapper<Assistant>;
  AssistantContext: AssistantContext;
  AuthTokens: ResolverTypeWrapper<AuthTokens>;
  AuthenticateInput: AuthenticateInput;
  Blog: ResolverTypeWrapper<Blog>;
  BlogParentTypes: BlogParentTypes;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Business: ResolverTypeWrapper<Business>;
  BusinessOwnerType: BusinessOwnerType;
  Company: ResolverTypeWrapper<Company>;
  CompanyWithDetails: ResolverTypeWrapper<CompanyWithDetails>;
  CreateAssistantInput: CreateAssistantInput;
  CreateBlogInput: CreateBlogInput;
  CreateBusinessInput: CreateBusinessInput;
  CreateCompanyInput: CreateCompanyInput;
  CreateDocumentInput: CreateDocumentInput;
  CreateFaqAnswerInput: CreateFaqAnswerInput;
  CreateFaqTopicInput: CreateFaqTopicInput;
  CreateFolderInput: CreateFolderInput;
  CreateGalleryInput: CreateGalleryInput;
  CreateImageInput: CreateImageInput;
  CreateMessageInput: CreateMessageInput;
  CreatePoolInput: CreatePoolInput;
  CreatePoolSpeculativeFieldsInput: CreatePoolSpeculativeFieldsInput;
  CreatePostInput: CreatePostInput;
  CreateQuestionAnswerInput: CreateQuestionAnswerInput;
  CreateQuestionInput: CreateQuestionInput;
  CreateTopicInput: CreateTopicInput;
  Document: ResolverTypeWrapper<Document>;
  EditBusinessDataInput: EditBusinessDataInput;
  EditBusinessInput: EditBusinessInput;
  EditPoolDataInput: EditPoolDataInput;
  EditPoolInput: EditPoolInput;
  EditPoolSpeculativeFieldsInput: EditPoolSpeculativeFieldsInput;
  FaqAnswer: ResolverTypeWrapper<FaqAnswer>;
  FaqParentTypes: FaqParentTypes;
  FaqTopic: ResolverTypeWrapper<FaqTopic>;
  FaucetRequest: ResolverTypeWrapper<FaucetRequest>;
  FaucetTokenType: FaucetTokenType;
  FilterInput: FilterInput;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Folder: ResolverTypeWrapper<Folder>;
  Gallery: ResolverTypeWrapper<Gallery>;
  GalleryParentTypes: GalleryParentTypes;
  GetBalancesInput: GetBalancesInput;
  GetBlogsFilterInput: GetBlogsFilterInput;
  GetCompaniesInput: GetCompaniesInput;
  GetDocumentsFilterInput: GetDocumentsFilterInput;
  GetFaqAnswersFilterInput: GetFaqAnswersFilterInput;
  GetFaqTopicsFilterInput: GetFaqTopicsFilterInput;
  GetFoldersFilterInput: GetFoldersFilterInput;
  GetGalleriesFilterInput: GetGalleriesFilterInput;
  GetImagesFilterInput: GetImagesFilterInput;
  GetPostsFilterInput: GetPostsFilterInput;
  GetQuestionsFilterInput: GetQuestionsFilterInput;
  GetSignatureTaskInput: GetSignatureTaskInput;
  GetTopicsFilterInput: GetTopicsFilterInput;
  GetTransactionsInput: GetTransactionsInput;
  GrantPermissionInput: GrantPermissionInput;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  IdResponse: ResolverTypeWrapper<IdResponse>;
  Image: ResolverTypeWrapper<Image>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  Member: ResolverTypeWrapper<Member>;
  Message: ResolverTypeWrapper<Message>;
  Mutation: ResolverTypeWrapper<{}>;
  PaginationInput: PaginationInput;
  ParentTypes: ParentTypes;
  Permission: ResolverTypeWrapper<Permission>;
  Pool: ResolverTypeWrapper<Pool>;
  PoolType: PoolType;
  Post: ResolverTypeWrapper<Post>;
  Query: ResolverTypeWrapper<{}>;
  Question: ResolverTypeWrapper<Question>;
  RefreshTokenInput: RefreshTokenInput;
  RemoveMemberInput: RemoveMemberInput;
  RequestBusinessApprovalSignaturesInput: RequestBusinessApprovalSignaturesInput;
  RequestPoolApprovalSignaturesInput: RequestPoolApprovalSignaturesInput;
  RequestTokenInput: RequestTokenInput;
  RevokePermissionInput: RevokePermissionInput;
  Signature: ResolverTypeWrapper<Signature>;
  SignatureTask: ResolverTypeWrapper<SignatureTask>;
  SortDirection: SortDirection;
  SortFieldInput: SortFieldInput;
  SpeculativeSpecificFields: ResolverTypeWrapper<SpeculativeSpecificFields>;
  StableSpecificFields: ResolverTypeWrapper<StableSpecificFields>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  TokenBalance: ResolverTypeWrapper<TokenBalance>;
  Topic: ResolverTypeWrapper<Topic>;
  Transaction: ResolverTypeWrapper<Transaction>;
  UnlockTimeResponse: ResolverTypeWrapper<UnlockTimeResponse>;
  UpdateAssistantInput: UpdateAssistantInput;
  UpdateBlogDataInput: UpdateBlogDataInput;
  UpdateBlogInput: UpdateBlogInput;
  UpdateCompanyDataInput: UpdateCompanyDataInput;
  UpdateCompanyInput: UpdateCompanyInput;
  UpdateDocumentDataInput: UpdateDocumentDataInput;
  UpdateDocumentInput: UpdateDocumentInput;
  UpdateFaqAnswerDataInput: UpdateFaqAnswerDataInput;
  UpdateFaqAnswerInput: UpdateFaqAnswerInput;
  UpdateFaqTopicDataInput: UpdateFaqTopicDataInput;
  UpdateFaqTopicInput: UpdateFaqTopicInput;
  UpdateFolderDataInput: UpdateFolderDataInput;
  UpdateFolderInput: UpdateFolderInput;
  UpdateGalleryDataInput: UpdateGalleryDataInput;
  UpdateGalleryInput: UpdateGalleryInput;
  UpdateImageDataInput: UpdateImageDataInput;
  UpdateImageInput: UpdateImageInput;
  UpdateMessageInput: UpdateMessageInput;
  UpdatePostDataInput: UpdatePostDataInput;
  UpdatePostInput: UpdatePostInput;
  UpdateQuestionAnswerDataInput: UpdateQuestionAnswerDataInput;
  UpdateQuestionAnswerInput: UpdateQuestionAnswerInput;
  UpdateQuestionTextDataInput: UpdateQuestionTextDataInput;
  UpdateQuestionTextInput: UpdateQuestionTextInput;
  UpdateTopicDataInput: UpdateTopicDataInput;
  UpdateTopicInput: UpdateTopicInput;
  User: ResolverTypeWrapper<User>;
  UserPermission: ResolverTypeWrapper<UserPermission>;
  UserWithPermissions: ResolverTypeWrapper<UserWithPermissions>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AddMemberInput: AddMemberInput;
  Answer: Answer;
  ApprovalSignaturesResponse: ApprovalSignaturesResponse;
  Assistant: Assistant;
  AuthTokens: AuthTokens;
  AuthenticateInput: AuthenticateInput;
  Blog: Blog;
  Boolean: Scalars['Boolean']['output'];
  Business: Business;
  Company: Company;
  CompanyWithDetails: CompanyWithDetails;
  CreateAssistantInput: CreateAssistantInput;
  CreateBlogInput: CreateBlogInput;
  CreateBusinessInput: CreateBusinessInput;
  CreateCompanyInput: CreateCompanyInput;
  CreateDocumentInput: CreateDocumentInput;
  CreateFaqAnswerInput: CreateFaqAnswerInput;
  CreateFaqTopicInput: CreateFaqTopicInput;
  CreateFolderInput: CreateFolderInput;
  CreateGalleryInput: CreateGalleryInput;
  CreateImageInput: CreateImageInput;
  CreateMessageInput: CreateMessageInput;
  CreatePoolInput: CreatePoolInput;
  CreatePoolSpeculativeFieldsInput: CreatePoolSpeculativeFieldsInput;
  CreatePostInput: CreatePostInput;
  CreateQuestionAnswerInput: CreateQuestionAnswerInput;
  CreateQuestionInput: CreateQuestionInput;
  CreateTopicInput: CreateTopicInput;
  Document: Document;
  EditBusinessDataInput: EditBusinessDataInput;
  EditBusinessInput: EditBusinessInput;
  EditPoolDataInput: EditPoolDataInput;
  EditPoolInput: EditPoolInput;
  EditPoolSpeculativeFieldsInput: EditPoolSpeculativeFieldsInput;
  FaqAnswer: FaqAnswer;
  FaqTopic: FaqTopic;
  FaucetRequest: FaucetRequest;
  FilterInput: FilterInput;
  Float: Scalars['Float']['output'];
  Folder: Folder;
  Gallery: Gallery;
  GetBalancesInput: GetBalancesInput;
  GetBlogsFilterInput: GetBlogsFilterInput;
  GetCompaniesInput: GetCompaniesInput;
  GetDocumentsFilterInput: GetDocumentsFilterInput;
  GetFaqAnswersFilterInput: GetFaqAnswersFilterInput;
  GetFaqTopicsFilterInput: GetFaqTopicsFilterInput;
  GetFoldersFilterInput: GetFoldersFilterInput;
  GetGalleriesFilterInput: GetGalleriesFilterInput;
  GetImagesFilterInput: GetImagesFilterInput;
  GetPostsFilterInput: GetPostsFilterInput;
  GetQuestionsFilterInput: GetQuestionsFilterInput;
  GetSignatureTaskInput: GetSignatureTaskInput;
  GetTopicsFilterInput: GetTopicsFilterInput;
  GetTransactionsInput: GetTransactionsInput;
  GrantPermissionInput: GrantPermissionInput;
  ID: Scalars['ID']['output'];
  IdResponse: IdResponse;
  Image: Image;
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  Member: Member;
  Message: Message;
  Mutation: {};
  PaginationInput: PaginationInput;
  Permission: Permission;
  Pool: Pool;
  Post: Post;
  Query: {};
  Question: Question;
  RefreshTokenInput: RefreshTokenInput;
  RemoveMemberInput: RemoveMemberInput;
  RequestBusinessApprovalSignaturesInput: RequestBusinessApprovalSignaturesInput;
  RequestPoolApprovalSignaturesInput: RequestPoolApprovalSignaturesInput;
  RequestTokenInput: RequestTokenInput;
  RevokePermissionInput: RevokePermissionInput;
  Signature: Signature;
  SignatureTask: SignatureTask;
  SortFieldInput: SortFieldInput;
  SpeculativeSpecificFields: SpeculativeSpecificFields;
  StableSpecificFields: StableSpecificFields;
  String: Scalars['String']['output'];
  TokenBalance: TokenBalance;
  Topic: Topic;
  Transaction: Transaction;
  UnlockTimeResponse: UnlockTimeResponse;
  UpdateAssistantInput: UpdateAssistantInput;
  UpdateBlogDataInput: UpdateBlogDataInput;
  UpdateBlogInput: UpdateBlogInput;
  UpdateCompanyDataInput: UpdateCompanyDataInput;
  UpdateCompanyInput: UpdateCompanyInput;
  UpdateDocumentDataInput: UpdateDocumentDataInput;
  UpdateDocumentInput: UpdateDocumentInput;
  UpdateFaqAnswerDataInput: UpdateFaqAnswerDataInput;
  UpdateFaqAnswerInput: UpdateFaqAnswerInput;
  UpdateFaqTopicDataInput: UpdateFaqTopicDataInput;
  UpdateFaqTopicInput: UpdateFaqTopicInput;
  UpdateFolderDataInput: UpdateFolderDataInput;
  UpdateFolderInput: UpdateFolderInput;
  UpdateGalleryDataInput: UpdateGalleryDataInput;
  UpdateGalleryInput: UpdateGalleryInput;
  UpdateImageDataInput: UpdateImageDataInput;
  UpdateImageInput: UpdateImageInput;
  UpdateMessageInput: UpdateMessageInput;
  UpdatePostDataInput: UpdatePostDataInput;
  UpdatePostInput: UpdatePostInput;
  UpdateQuestionAnswerDataInput: UpdateQuestionAnswerDataInput;
  UpdateQuestionAnswerInput: UpdateQuestionAnswerInput;
  UpdateQuestionTextDataInput: UpdateQuestionTextDataInput;
  UpdateQuestionTextInput: UpdateQuestionTextInput;
  UpdateTopicDataInput: UpdateTopicDataInput;
  UpdateTopicInput: UpdateTopicInput;
  User: User;
  UserPermission: UserPermission;
  UserWithPermissions: UserWithPermissions;
}>;

export type AnswerResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Answer'] = ResolversParentTypes['Answer']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  text?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ApprovalSignaturesResponseResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ApprovalSignaturesResponse'] = ResolversParentTypes['ApprovalSignaturesResponse']> = ResolversObject<{
  taskId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AssistantResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Assistant'] = ResolversParentTypes['Assistant']> = ResolversObject<{
  contextPreferences?: Resolver<Array<ResolversTypes['AssistantContext']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AuthTokensResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AuthTokens'] = ResolversParentTypes['AuthTokens']> = ResolversObject<{
  accessToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  wallet?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BlogResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Blog'] = ResolversParentTypes['Blog']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BusinessResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Business'] = ResolversParentTypes['Business']> = ResolversObject<{
  approvalSignaturesTaskExpired?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  approvalSignaturesTaskId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  chainId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  generationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  image?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  paused?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  riskScore?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  tokenAddress?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CompanyResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Company'] = ResolversParentTypes['Company']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CompanyWithDetailsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CompanyWithDetails'] = ResolversParentTypes['CompanyWithDetails']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  users?: Resolver<Array<ResolversTypes['UserWithPermissions']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type DocumentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Document'] = ResolversParentTypes['Document']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  folderId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  link?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FaqAnswerResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FaqAnswer'] = ResolversParentTypes['FaqAnswer']> = ResolversObject<{
  answer?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  order?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  question?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  topicId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FaqTopicResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FaqTopic'] = ResolversParentTypes['FaqTopic']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FaucetRequestResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FaucetRequest'] = ResolversParentTypes['FaucetRequest']> = ResolversObject<{
  amount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  tokenType?: Resolver<ResolversTypes['FaucetTokenType'], ParentType, ContextType>;
  transactionHash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  wallet?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FolderResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Folder'] = ResolversParentTypes['Folder']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GalleryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Gallery'] = ResolversParentTypes['Gallery']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IdResponseResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['IdResponse'] = ResolversParentTypes['IdResponse']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ImageResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Image'] = ResolversParentTypes['Image']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  galleryId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  link?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type MemberResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Member'] = ResolversParentTypes['Member']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MessageResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Message'] = ResolversParentTypes['Message']> = ResolversObject<{
  assistantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  text?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  _?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  addMember?: Resolver<ResolversTypes['Member'], ParentType, ContextType, RequireFields<MutationAddMemberArgs, 'input'>>;
  authenticate?: Resolver<ResolversTypes['AuthTokens'], ParentType, ContextType, RequireFields<MutationAuthenticateArgs, 'input'>>;
  createAssistant?: Resolver<ResolversTypes['Assistant'], ParentType, ContextType, RequireFields<MutationCreateAssistantArgs, 'input'>>;
  createBlog?: Resolver<ResolversTypes['Blog'], ParentType, ContextType, RequireFields<MutationCreateBlogArgs, 'input'>>;
  createBusiness?: Resolver<ResolversTypes['Business'], ParentType, ContextType, RequireFields<MutationCreateBusinessArgs, 'input'>>;
  createCompany?: Resolver<ResolversTypes['Company'], ParentType, ContextType, RequireFields<MutationCreateCompanyArgs, 'input'>>;
  createDocument?: Resolver<ResolversTypes['Document'], ParentType, ContextType, RequireFields<MutationCreateDocumentArgs, 'input'>>;
  createFaqAnswer?: Resolver<ResolversTypes['FaqAnswer'], ParentType, ContextType, RequireFields<MutationCreateFaqAnswerArgs, 'input'>>;
  createFaqTopic?: Resolver<ResolversTypes['FaqTopic'], ParentType, ContextType, RequireFields<MutationCreateFaqTopicArgs, 'input'>>;
  createFolder?: Resolver<ResolversTypes['Folder'], ParentType, ContextType, RequireFields<MutationCreateFolderArgs, 'input'>>;
  createGallery?: Resolver<ResolversTypes['Gallery'], ParentType, ContextType, RequireFields<MutationCreateGalleryArgs, 'input'>>;
  createImage?: Resolver<ResolversTypes['Image'], ParentType, ContextType, RequireFields<MutationCreateImageArgs, 'input'>>;
  createMessage?: Resolver<Array<ResolversTypes['Message']>, ParentType, ContextType, RequireFields<MutationCreateMessageArgs, 'input'>>;
  createPool?: Resolver<ResolversTypes['Pool'], ParentType, ContextType, RequireFields<MutationCreatePoolArgs, 'input'>>;
  createPost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationCreatePostArgs, 'input'>>;
  createQuestion?: Resolver<ResolversTypes['Question'], ParentType, ContextType, RequireFields<MutationCreateQuestionArgs, 'input'>>;
  createQuestionAnswer?: Resolver<ResolversTypes['Question'], ParentType, ContextType, RequireFields<MutationCreateQuestionAnswerArgs, 'input'>>;
  createTopic?: Resolver<ResolversTypes['Topic'], ParentType, ContextType, RequireFields<MutationCreateTopicArgs, 'input'>>;
  deleteAssistant?: Resolver<ResolversTypes['IdResponse'], ParentType, ContextType, RequireFields<MutationDeleteAssistantArgs, 'id'>>;
  deleteBlog?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteBlogArgs, 'id'>>;
  deleteCompany?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteCompanyArgs, 'id'>>;
  deleteDocument?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteDocumentArgs, 'id'>>;
  deleteFaqAnswer?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteFaqAnswerArgs, 'id'>>;
  deleteFaqTopic?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteFaqTopicArgs, 'id'>>;
  deleteFolder?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteFolderArgs, 'id'>>;
  deleteGallery?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteGalleryArgs, 'id'>>;
  deleteImage?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteImageArgs, 'id'>>;
  deleteMessage?: Resolver<ResolversTypes['IdResponse'], ParentType, ContextType, RequireFields<MutationDeleteMessageArgs, 'id'>>;
  deletePost?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeletePostArgs, 'id'>>;
  deleteQuestion?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteQuestionArgs, 'id'>>;
  deleteTopic?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationDeleteTopicArgs, 'id'>>;
  editBusiness?: Resolver<ResolversTypes['Business'], ParentType, ContextType, RequireFields<MutationEditBusinessArgs, 'input'>>;
  editPool?: Resolver<ResolversTypes['Pool'], ParentType, ContextType, RequireFields<MutationEditPoolArgs, 'input'>>;
  grantPermission?: Resolver<ResolversTypes['Permission'], ParentType, ContextType, RequireFields<MutationGrantPermissionArgs, 'input'>>;
  refreshToken?: Resolver<ResolversTypes['AuthTokens'], ParentType, ContextType, RequireFields<MutationRefreshTokenArgs, 'input'>>;
  rejectApprovalSignatures?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRejectApprovalSignaturesArgs, 'id'>>;
  rejectPoolApprovalSignatures?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRejectPoolApprovalSignaturesArgs, 'id'>>;
  removeMember?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationRemoveMemberArgs, 'input'>>;
  requestApprovalSignatures?: Resolver<ResolversTypes['ApprovalSignaturesResponse'], ParentType, ContextType, RequireFields<MutationRequestApprovalSignaturesArgs, 'input'>>;
  requestGas?: Resolver<ResolversTypes['FaucetRequest'], ParentType, ContextType, RequireFields<MutationRequestGasArgs, 'input'>>;
  requestHold?: Resolver<ResolversTypes['FaucetRequest'], ParentType, ContextType, RequireFields<MutationRequestHoldArgs, 'input'>>;
  requestPoolApprovalSignatures?: Resolver<ResolversTypes['ApprovalSignaturesResponse'], ParentType, ContextType, RequireFields<MutationRequestPoolApprovalSignaturesArgs, 'input'>>;
  revokePermission?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationRevokePermissionArgs, 'input'>>;
  toggleQuestionLike?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationToggleQuestionLikeArgs, 'questionId'>>;
  updateAssistant?: Resolver<ResolversTypes['Assistant'], ParentType, ContextType, RequireFields<MutationUpdateAssistantArgs, 'input'>>;
  updateBlog?: Resolver<ResolversTypes['Blog'], ParentType, ContextType, RequireFields<MutationUpdateBlogArgs, 'input'>>;
  updateCompany?: Resolver<ResolversTypes['Company'], ParentType, ContextType, RequireFields<MutationUpdateCompanyArgs, 'input'>>;
  updateDocument?: Resolver<ResolversTypes['Document'], ParentType, ContextType, RequireFields<MutationUpdateDocumentArgs, 'input'>>;
  updateFaqAnswer?: Resolver<ResolversTypes['FaqAnswer'], ParentType, ContextType, RequireFields<MutationUpdateFaqAnswerArgs, 'input'>>;
  updateFaqTopic?: Resolver<ResolversTypes['FaqTopic'], ParentType, ContextType, RequireFields<MutationUpdateFaqTopicArgs, 'input'>>;
  updateFolder?: Resolver<ResolversTypes['Folder'], ParentType, ContextType, RequireFields<MutationUpdateFolderArgs, 'input'>>;
  updateGallery?: Resolver<ResolversTypes['Gallery'], ParentType, ContextType, RequireFields<MutationUpdateGalleryArgs, 'input'>>;
  updateImage?: Resolver<ResolversTypes['Image'], ParentType, ContextType, RequireFields<MutationUpdateImageArgs, 'input'>>;
  updateMessage?: Resolver<ResolversTypes['Message'], ParentType, ContextType, RequireFields<MutationUpdateMessageArgs, 'input'>>;
  updatePoolRiskScore?: Resolver<ResolversTypes['Pool'], ParentType, ContextType, RequireFields<MutationUpdatePoolRiskScoreArgs, 'id'>>;
  updatePost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationUpdatePostArgs, 'input'>>;
  updateQuestionAnswer?: Resolver<ResolversTypes['Question'], ParentType, ContextType, RequireFields<MutationUpdateQuestionAnswerArgs, 'input'>>;
  updateQuestionText?: Resolver<ResolversTypes['Question'], ParentType, ContextType, RequireFields<MutationUpdateQuestionTextArgs, 'input'>>;
  updateRiskScore?: Resolver<ResolversTypes['Business'], ParentType, ContextType, RequireFields<MutationUpdateRiskScoreArgs, 'id'>>;
  updateTopic?: Resolver<ResolversTypes['Topic'], ParentType, ContextType, RequireFields<MutationUpdateTopicArgs, 'input'>>;
}>;

export type PermissionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Permission'] = ResolversParentTypes['Permission']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  entity?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  permission?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PoolResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Pool'] = ResolversParentTypes['Pool']> = ResolversObject<{
  accumulatedHoldAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accumulatedRwaAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allocatedHoldAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  approvalSignaturesTaskExpired?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  approvalSignaturesTaskId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  availableReturnBalance?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  awaitingRwaAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  businessId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  chainId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  completionPeriodDuration?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  completionPeriodExpired?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  entryFeePercent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  entryPeriodDuration?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  entryPeriodExpired?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  exitFeePercent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  expectedHoldAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  expectedReturnAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  expectedRwaAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  holdToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isFullyReturned?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  isTargetReached?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  paused?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  poolAddress?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  returnedAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  rewardPercent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  riskScore?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  rwaAddress?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  speculativeSpecificFields?: Resolver<Maybe<ResolversTypes['SpeculativeSpecificFields']>, ParentType, ContextType>;
  stableSpecificFields?: Resolver<Maybe<ResolversTypes['StableSpecificFields']>, ParentType, ContextType>;
  tags?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  tokenId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['PoolType'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PostResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Post'] = ResolversParentTypes['Post']> = ResolversObject<{
  blogId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  _?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  getAssistant?: Resolver<ResolversTypes['Assistant'], ParentType, ContextType, RequireFields<QueryGetAssistantArgs, 'id'>>;
  getBalances?: Resolver<Array<ResolversTypes['TokenBalance']>, ParentType, ContextType, RequireFields<QueryGetBalancesArgs, 'input'>>;
  getBlog?: Resolver<ResolversTypes['Blog'], ParentType, ContextType, RequireFields<QueryGetBlogArgs, 'id'>>;
  getBlogs?: Resolver<Array<ResolversTypes['Blog']>, ParentType, ContextType, Partial<QueryGetBlogsArgs>>;
  getBusiness?: Resolver<ResolversTypes['Business'], ParentType, ContextType, RequireFields<QueryGetBusinessArgs, 'id'>>;
  getBusinesses?: Resolver<Array<ResolversTypes['Business']>, ParentType, ContextType, RequireFields<QueryGetBusinessesArgs, 'input'>>;
  getCompanies?: Resolver<Array<ResolversTypes['Company']>, ParentType, ContextType, Partial<QueryGetCompaniesArgs>>;
  getCompany?: Resolver<ResolversTypes['CompanyWithDetails'], ParentType, ContextType, RequireFields<QueryGetCompanyArgs, 'id'>>;
  getDocument?: Resolver<ResolversTypes['Document'], ParentType, ContextType, RequireFields<QueryGetDocumentArgs, 'id'>>;
  getDocuments?: Resolver<Array<ResolversTypes['Document']>, ParentType, ContextType, Partial<QueryGetDocumentsArgs>>;
  getFaqAnswer?: Resolver<ResolversTypes['FaqAnswer'], ParentType, ContextType, RequireFields<QueryGetFaqAnswerArgs, 'id'>>;
  getFaqAnswers?: Resolver<Array<ResolversTypes['FaqAnswer']>, ParentType, ContextType, Partial<QueryGetFaqAnswersArgs>>;
  getFaqTopic?: Resolver<ResolversTypes['FaqTopic'], ParentType, ContextType, RequireFields<QueryGetFaqTopicArgs, 'id'>>;
  getFaqTopics?: Resolver<Array<ResolversTypes['FaqTopic']>, ParentType, ContextType, Partial<QueryGetFaqTopicsArgs>>;
  getFolder?: Resolver<ResolversTypes['Folder'], ParentType, ContextType, RequireFields<QueryGetFolderArgs, 'id'>>;
  getFolders?: Resolver<Array<ResolversTypes['Folder']>, ParentType, ContextType, Partial<QueryGetFoldersArgs>>;
  getGalleries?: Resolver<Array<ResolversTypes['Gallery']>, ParentType, ContextType, Partial<QueryGetGalleriesArgs>>;
  getGallery?: Resolver<ResolversTypes['Gallery'], ParentType, ContextType, RequireFields<QueryGetGalleryArgs, 'id'>>;
  getHistory?: Resolver<Array<ResolversTypes['FaucetRequest']>, ParentType, ContextType, Partial<QueryGetHistoryArgs>>;
  getImage?: Resolver<ResolversTypes['Image'], ParentType, ContextType, RequireFields<QueryGetImageArgs, 'id'>>;
  getImages?: Resolver<Array<ResolversTypes['Image']>, ParentType, ContextType, Partial<QueryGetImagesArgs>>;
  getMessage?: Resolver<ResolversTypes['Message'], ParentType, ContextType, RequireFields<QueryGetMessageArgs, 'id'>>;
  getMessageHistory?: Resolver<Array<ResolversTypes['Message']>, ParentType, ContextType, RequireFields<QueryGetMessageHistoryArgs, 'assistantId'>>;
  getPool?: Resolver<ResolversTypes['Pool'], ParentType, ContextType, RequireFields<QueryGetPoolArgs, 'id'>>;
  getPools?: Resolver<Array<ResolversTypes['Pool']>, ParentType, ContextType, RequireFields<QueryGetPoolsArgs, 'input'>>;
  getPost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<QueryGetPostArgs, 'id'>>;
  getPosts?: Resolver<Array<ResolversTypes['Post']>, ParentType, ContextType, Partial<QueryGetPostsArgs>>;
  getQuestion?: Resolver<ResolversTypes['Question'], ParentType, ContextType, RequireFields<QueryGetQuestionArgs, 'id'>>;
  getQuestions?: Resolver<Array<ResolversTypes['Question']>, ParentType, ContextType, Partial<QueryGetQuestionsArgs>>;
  getSignatureTask?: Resolver<ResolversTypes['SignatureTask'], ParentType, ContextType, RequireFields<QueryGetSignatureTaskArgs, 'input'>>;
  getTopic?: Resolver<ResolversTypes['Topic'], ParentType, ContextType, RequireFields<QueryGetTopicArgs, 'id'>>;
  getTopics?: Resolver<Array<ResolversTypes['Topic']>, ParentType, ContextType, Partial<QueryGetTopicsArgs>>;
  getTransactions?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType, RequireFields<QueryGetTransactionsArgs, 'input'>>;
  getUnlockTime?: Resolver<ResolversTypes['UnlockTimeResponse'], ParentType, ContextType>;
  getUserAssistants?: Resolver<Array<ResolversTypes['Assistant']>, ParentType, ContextType, Partial<QueryGetUserAssistantsArgs>>;
}>;

export type QuestionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Question'] = ResolversParentTypes['Question']> = ResolversObject<{
  answer?: Resolver<Maybe<ResolversTypes['Answer']>, ParentType, ContextType>;
  answered?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  likesCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  text?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  topicId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SignatureResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Signature'] = ResolversParentTypes['Signature']> = ResolversObject<{
  signature?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  signer?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SignatureTaskResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SignatureTask'] = ResolversParentTypes['SignatureTask']> = ResolversObject<{
  completed?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  expired?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  hash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  requiredSignatures?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  signatures?: Resolver<Maybe<Array<ResolversTypes['Signature']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SpeculativeSpecificFieldsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SpeculativeSpecificFields'] = ResolversParentTypes['SpeculativeSpecificFields']> = ResolversObject<{
  availableBonusAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  expectedBonusAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  k?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  realHoldReserve?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  rwaMultiplier?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  rwaMultiplierIndex?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  virtualHoldReserve?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  virtualRwaReserve?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StableSpecificFieldsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['StableSpecificFields'] = ResolversParentTypes['StableSpecificFields']> = ResolversObject<{
  fixedMintPrice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TokenBalanceResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TokenBalance'] = ResolversParentTypes['TokenBalance']> = ResolversObject<{
  balance?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  chainId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lastUpdateBlock?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  owner?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tokenAddress?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TopicResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Topic'] = ResolversParentTypes['Topic']> = ResolversObject<{
  creator?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grandParentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TransactionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Transaction'] = ResolversParentTypes['Transaction']> = ResolversObject<{
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  blockNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  chainId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  from?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  to?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tokenAddress?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tokenId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  transactionHash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UnlockTimeResponseResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UnlockTimeResponse'] = ResolversParentTypes['UnlockTimeResponse']> = ResolversObject<{
  gasUnlockTime?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  holdUnlockTime?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  nonce?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  wallet?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserPermissionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UserPermission'] = ResolversParentTypes['UserPermission']> = ResolversObject<{
  entity?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  permission?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserWithPermissionsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UserWithPermissions'] = ResolversParentTypes['UserWithPermissions']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  permissions?: Resolver<Array<ResolversTypes['UserPermission']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  Answer?: AnswerResolvers<ContextType>;
  ApprovalSignaturesResponse?: ApprovalSignaturesResponseResolvers<ContextType>;
  Assistant?: AssistantResolvers<ContextType>;
  AuthTokens?: AuthTokensResolvers<ContextType>;
  Blog?: BlogResolvers<ContextType>;
  Business?: BusinessResolvers<ContextType>;
  Company?: CompanyResolvers<ContextType>;
  CompanyWithDetails?: CompanyWithDetailsResolvers<ContextType>;
  Document?: DocumentResolvers<ContextType>;
  FaqAnswer?: FaqAnswerResolvers<ContextType>;
  FaqTopic?: FaqTopicResolvers<ContextType>;
  FaucetRequest?: FaucetRequestResolvers<ContextType>;
  Folder?: FolderResolvers<ContextType>;
  Gallery?: GalleryResolvers<ContextType>;
  IdResponse?: IdResponseResolvers<ContextType>;
  Image?: ImageResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  Member?: MemberResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Permission?: PermissionResolvers<ContextType>;
  Pool?: PoolResolvers<ContextType>;
  Post?: PostResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Question?: QuestionResolvers<ContextType>;
  Signature?: SignatureResolvers<ContextType>;
  SignatureTask?: SignatureTaskResolvers<ContextType>;
  SpeculativeSpecificFields?: SpeculativeSpecificFieldsResolvers<ContextType>;
  StableSpecificFields?: StableSpecificFieldsResolvers<ContextType>;
  TokenBalance?: TokenBalanceResolvers<ContextType>;
  Topic?: TopicResolvers<ContextType>;
  Transaction?: TransactionResolvers<ContextType>;
  UnlockTimeResponse?: UnlockTimeResponseResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  UserPermission?: UserPermissionResolvers<ContextType>;
  UserWithPermissions?: UserWithPermissionsResolvers<ContextType>;
}>;


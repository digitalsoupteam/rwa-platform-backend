import { Resolvers } from '../../../generated/types';
import { getDocument } from './queries/getDocument';
import { getDocuments } from './queries/getDocuments';
import { getFolder } from './queries/getFolder';
import { getFolders } from './queries/getFolders';
import { createDocument } from './mutations/createDocument';
import { updateDocument } from './mutations/updateDocument';
import { deleteDocument } from './mutations/deleteDocument';
import { createFolder } from './mutations/createFolder';
import { updateFolder } from './mutations/updateFolder';
import { deleteFolder } from './mutations/deleteFolder';

export const documentsResolvers: Resolvers = {
  Query: {
    getDocument,
    getDocuments,
    getFolder,
    getFolders,
  },
  Mutation: {
    createDocument,
    updateDocument,
    deleteDocument,
    createFolder,
    updateFolder,
    deleteFolder,
  },
};
import { logger } from "@shared/monitoring/src/logger";
import { DocumentsFolderRepository } from "../repositories/documentsFolder.repository";
import { DocumentRepository } from "../repositories/document.repository";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { IDocumentEntity } from "../models/entity/document.entity";
import { DocumentEntity } from "../models/entity/document.entity";

export class DocumentsService {
  constructor(
    private readonly documentsFolderRepository: DocumentsFolderRepository,
    private readonly documentRepository: DocumentRepository
  ) {}

  /**
   * Creates a new documents folder
   */
  async createFolder(data: {
    name: string;
    parentId: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new documents folder", { name: data.name });
    
    const folder = await this.documentsFolderRepository.create({
      name: data.name,
      parentId: data.parentId,
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      creator: data.creator,
      grandParentId: data.grandParentId
    });

    return {
      id: folder._id.toString(),
      name: folder.name,
      parentId: folder.parentId,
      ownerId: folder.ownerId,
      ownerType: folder.ownerType,
      creator: folder.creator,
      grandParentId: folder.grandParentId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  /**
   * Updates folder name
   */
  async updateFolder(params: { id: string, updateData: { name: string } }) {
    logger.debug("Updating folder", params);
    
    const folder = await this.documentsFolderRepository.update(params.id, params.updateData);

    return {
      id: folder._id.toString(),
      name: folder.name,
      parentId: folder.parentId,
      ownerId: folder.ownerId,
      ownerType: folder.ownerType,
      creator: folder.creator,
      grandParentId: folder.grandParentId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  /**
   * Deletes a folder and all its documents
   */
  async deleteFolder(id: string) {
    logger.debug("Deleting folder and its documents", { id });
    
    // First delete all documents in the folder
    const documents = await this.documentRepository.findAll({ folderIds: [id] });
    for (const doc of documents) {
      await this.documentRepository.delete(doc._id.toString());
    }

    // Then delete the folder itself
    await this.documentsFolderRepository.delete(id);

    return { id };
  }

  /**
   * Gets folder by ID
   */
  async getFolder(id: string) {
    logger.debug("Getting folder", { id });
    
    const folder = await this.documentsFolderRepository.findById(id);

    return {
      id: folder._id.toString(),
      name: folder.name,
      parentId: folder.parentId,
      ownerId: folder.ownerId,
      ownerType: folder.ownerType,
      creator: folder.creator,
      grandParentId: folder.grandParentId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  /**
   * Gets folders list with filters, pagination and sorting
   */
  async getFolders(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting folders list", params);
    
    const folders = await this.documentsFolderRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return folders.map(folder => ({
      id: folder._id.toString(),
      name: folder.name,
      parentId: folder.parentId,
      ownerId: folder.ownerId,
      ownerType: folder.ownerType,
      creator: folder.creator,
      grandParentId: folder.grandParentId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }));
  }

  /**
   * Creates a new document in a folder
   */
  async createDocument(data: {
    folderId: string;
    name: string;
    link: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new document", { name: data.name });
    
    const document = await this.documentRepository.create(data);

    return {
      id: document._id.toString(),
      folderId: document.folderId.toString(),
      name: document.name,
      link: document.link,
      ownerId: document.ownerId,
      ownerType: document.ownerType,
      creator: document.creator,
      parentId: document.parentId,
      grandParentId: document.grandParentId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Updates document
   */
  async updateDocument(params: {
    id: string;
    updateData: {
      name?: string;
      link?: string;
    }
  }) {
    logger.debug("Updating document", params);
    
    const document = await this.documentRepository.update(params.id, params.updateData);

    return {
      id: document._id.toString(),
      folderId: document.folderId.toString(),
      name: document.name,
      link: document.link,
      ownerId: document.ownerId,
      ownerType: document.ownerType,
      creator: document.creator,
      parentId: document.parentId,
      grandParentId: document.grandParentId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Deletes document
   */
  async deleteDocument(id: string) {
    logger.debug("Deleting document", { id });
    await this.documentRepository.delete(id);
    return { id };
  }

  /**
   * Gets document by ID
   */
  async getDocument(id: string) {
    logger.debug("Getting document", { id });
    
    const document = await this.documentRepository.findById(id);

    return {
      id: document._id.toString(),
      folderId: document.folderId.toString(),
      name: document.name,
      link: document.link,
      ownerId: document.ownerId,
      ownerType: document.ownerType,
      creator: document.creator,
      parentId: document.parentId,
      grandParentId: document.grandParentId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Gets documents list with filters, pagination and sorting
   */
  async getDocuments(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting documents list", params);
    
    const documents = await this.documentRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return documents.map(doc => ({
      id: doc._id.toString(),
      folderId: doc.folderId.toString(),
      name: doc.name,
      link: doc.link,
      ownerId: doc.ownerId,
      ownerType: doc.ownerType,
      creator: doc.creator,
      parentId: doc.parentId,
      grandParentId: doc.grandParentId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }
}
import { DocumentsFolderRepository } from '../repositories/documentsFolder.repository';
import { DocumentRepository } from '../repositories/document.repository';
import type { SortOrder } from 'mongoose';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class DocumentsService {
  constructor(
    private readonly documentsFolderRepository: DocumentsFolderRepository,
    private readonly documentRepository: DocumentRepository,
  ) {}

  /**
   * Creates a new documents folder
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      name: a[0].name,
      parentId: a[0].parentId,
      ownerId: a[0].ownerId,
      ownerType: a[0].ownerType,
      creator: a[0].creator,
      grandParentId: a[0].grandParentId,
    }),
  })
  async createFolder(data: {
    name: string;
    parentId: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    grandParentId: string;
  }) {
    setSpanAttributes({ entityType: 'folder' });

    const folder = await this.documentsFolderRepository.create({
      name: data.name,
      parentId: data.parentId,
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      creator: data.creator,
      grandParentId: data.grandParentId,
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0], name: a[1].name }),
  })
  async updateFolder(params: { id: string; updateData: { name: string } }) {
    setSpanAttributes({ entityId: params.id, entityType: 'folder' });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async deleteFolder(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'folder' });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getFolder(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'folder' });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ limit: a[0].limit, offset: a[0].offset }),
  })
  async getFolders(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({ entityType: 'folder' });

    const folders = await this.documentsFolderRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset,
    );

    return folders.map((folder) => ({
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      name: a[0].name,
      parentId: a[0].parentId,
      ownerId: a[0].ownerId,
      ownerType: a[0].ownerType,
      creator: a[0].creator,
      grandParentId: a[0].grandParentId,
    }),
  })
  async createDocument(data: {
    folderId: string;
    name: string;
    link: string;
    mimeType: string;
    size: number;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    setSpanAttributes({ entityType: 'document' });

    const document = await this.documentRepository.create(data);

    return {
      id: document._id.toString(),
      folderId: document.folderId.toString(),
      name: document.name,
      link: document.link,
      mimeType: document.mimeType,
      size: document.size,
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0], name: a[1].name }),
  })
  async updateDocument(params: {
    id: string;
    updateData: {
      name?: string;
    };
  }) {
    setSpanAttributes({ entityId: params.id, entityType: 'document' });

    const document = await this.documentRepository.update(params.id, params.updateData);

    return {
      id: document._id.toString(),
      folderId: document.folderId.toString(),
      name: document.name,
      link: document.link,
      mimeType: document.mimeType,
      size: document.size,
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async deleteDocument(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'document' });

    await this.documentRepository.delete(id);
    return { id };
  }

  /**
   * Gets document by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getDocument(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'document' });

    const document = await this.documentRepository.findById(id);

    return {
      id: document._id.toString(),
      folderId: document.folderId.toString(),
      name: document.name,
      link: document.link,
      mimeType: document.mimeType,
      size: document.size,
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ limit: a[0].limit, offset: a[0].offset }),
  })
  async getDocuments(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({ entityType: 'document' });

    const documents = await this.documentRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return documents.map((doc) => ({
      id: doc._id.toString(),
      folderId: doc.folderId.toString(),
      name: doc.name,
      link: doc.link,
      mimeType: doc.mimeType,
      size: doc.size,
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

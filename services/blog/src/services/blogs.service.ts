import { logger } from "@shared/monitoring/src/logger";
import { BlogRepository } from "../repositories/blog.repository";
import { PostRepository } from "../repositories/post.repository";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class BlogsService {
  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly postRepository: PostRepository
  ) {}

  /**
   * Creates a new blog
   */
  async createBlog(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new blog", { name: data.name });
    
    const blog = await this.blogRepository.create(data);

    return {
      id: blog._id.toString(),
      name: blog.name,
      ownerId: blog.ownerId,
      ownerType: blog.ownerType,
      creator: blog.creator,
      parentId: blog.parentId,
      grandParentId: blog.grandParentId,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
  }

  /**
   * Updates blog name
   */
  async updateBlog(params: { id: string, updateData: { name: string } }) {
    logger.debug("Updating blog", params);
    
    const blog = await this.blogRepository.update(params.id, params.updateData);

    return {
      id: blog._id.toString(),
      name: blog.name,
      ownerId: blog.ownerId,
      ownerType: blog.ownerType,
      creator: blog.creator,
      parentId: blog.parentId,
      grandParentId: blog.grandParentId,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
  }

  /**
   * Deletes a blog and all its posts
   */
  async deleteBlog(id: string) {
    logger.debug("Deleting blog and its posts", { id });
    
    // First delete all posts in the blog
    const posts = await this.postRepository.findAll({ blogIds: [id] });
    for (const post of posts) {
      await this.postRepository.delete(post._id.toString());
    }

    // Then delete the blog itself
    await this.blogRepository.delete(id);

    return { id };
  }

  /**
   * Gets blog by ID
   */
  async getBlog(id: string) {
    logger.debug("Getting blog", { id });
    
    const blog = await this.blogRepository.findById(id);

    return {
      id: blog._id.toString(),
      name: blog.name,
      ownerId: blog.ownerId,
      ownerType: blog.ownerType,
      creator: blog.creator,
      parentId: blog.parentId,
      grandParentId: blog.grandParentId,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
  }

  /**
   * Gets blogs list with filters, pagination and sorting
   */
  async getBlogs(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting blogs list", params);
    
    const blogs = await this.blogRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return blogs.map(blog => ({
      id: blog._id.toString(),
      name: blog.name,
      ownerId: blog.ownerId,
      ownerType: blog.ownerType,
      creator: blog.creator,
      parentId: blog.parentId,
      grandParentId: blog.grandParentId,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    }));
  }

  /**
   * Creates a new post in a blog
   */
  async createPost(data: {
    blogId: string;
    title: string;
    content: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
    images?: string[];
    documents?: string[];
  }) {
    logger.debug("Creating new post", { title: data.title });
    
    const post = await this.postRepository.create(data);

    return {
      id: post._id.toString(),
      blogId: post.blogId.toString(),
      title: post.title,
      content: post.content,
      images: post.images,
      documents: post.documents,
      ownerId: post.ownerId,
      ownerType: post.ownerType,
      creator: post.creator,
      parentId: post.parentId,
      grandParentId: post.grandParentId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  /**
   * Updates post
   */
  async updatePost(params: {
    id: string;
    updateData: {
      title?: string;
      content?: string;
      images?: string[];
      documents?: string[];
    }
  }) {
    logger.debug("Updating post", params);
    
    const post = await this.postRepository.update(params.id, params.updateData);

    return {
      id: post._id.toString(),
      blogId: post.blogId.toString(),
      title: post.title,
      content: post.content,
      images: post.images,
      documents: post.documents,
      ownerId: post.ownerId,
      ownerType: post.ownerType,
      creator: post.creator,
      parentId: post.parentId,
      grandParentId: post.grandParentId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  /**
   * Deletes post
   */
  async deletePost(id: string) {
    logger.debug("Deleting post", { id });
    await this.postRepository.delete(id);
    return { id };
  }

  /**
   * Gets post by ID
   */
  async getPost(id: string) {
    logger.debug("Getting post", { id });
    
    const post = await this.postRepository.findById(id);

    return {
      id: post._id.toString(),
      blogId: post.blogId.toString(),
      title: post.title,
      content: post.content,
      images: post.images,
      documents: post.documents,
      ownerId: post.ownerId,
      ownerType: post.ownerType,
      creator: post.creator,
      parentId: post.parentId,
      grandParentId: post.grandParentId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  /**
   * Gets posts list with filters, pagination and sorting
   */
  async getPosts(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting posts list", params);
    
    const posts = await this.postRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return posts.map(post => ({
      id: post._id.toString(),
      blogId: post.blogId.toString(),
      title: post.title,
      content: post.content,
      images: post.images,
      documents: post.documents,
      ownerId: post.ownerId,
      ownerType: post.ownerType,
      creator: post.creator,
      parentId: post.parentId,
      grandParentId: post.grandParentId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
  }
}
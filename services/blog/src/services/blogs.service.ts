import { BlogRepository } from '../repositories/blog.repository';
import { PostRepository } from '../repositories/post.repository';
import type { SortOrder } from 'mongoose';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class BlogsService {
  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly postRepository: PostRepository,
  ) {}

  /**
   * Creates a new blog
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      name: a[0].name,
      ownerId: a[0].ownerId,
      ownerType: a[0].ownerType,
      creator: a[0].creator,
      parentId: a[0].parentId,
      grandParentId: a[0].grandParentId,
    }),
  })
  async createBlog(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    setSpanAttributes({
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      creator: data.creator,
      parentId: data.parentId,
      grandParentId: data.grandParentId,
    });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, limit: a[0].limit, offset: a[0].offset }),
  })
  async updateBlog(params: { id: string; updateData: { name: string } }) {
    setSpanAttributes({ id: params.id });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async deleteBlog(id: string) {
    setSpanAttributes({ id });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getBlog(id: string) {
    setSpanAttributes({ id });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, limit: a[0].limit, offset: a[0].offset }),
  })
  async getBlogs(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({
      filterKeys: Object.keys(params.filter).join(','),
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    });
    const blogs = await this.blogRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return blogs.map((blog) => ({
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      name: a[0].name,
      ownerId: a[0].ownerId,
      ownerType: a[0].ownerType,
      creator: a[0].creator,
      parentId: a[0].parentId,
      grandParentId: a[0].grandParentId,
    }),
  })
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
    setSpanAttributes({
      blogId: data.blogId,
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      creator: data.creator,
      parentId: data.parentId,
    });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, limit: a[0].limit, offset: a[0].offset }),
  })
  async updatePost(params: {
    id: string;
    updateData: {
      title?: string;
      content?: string;
      images?: string[];
      documents?: string[];
    };
  }) {
    setSpanAttributes({ id: params.id });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async deletePost(id: string) {
    setSpanAttributes({ id });
    await this.postRepository.delete(id);
    return { id };
  }

  /**
   * Gets post by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getPost(id: string) {
    setSpanAttributes({ id });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, limit: a[0].limit, offset: a[0].offset }),
  })
  async getPosts(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({
      filterKeys: Object.keys(params.filter).join(','),
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    });
    const posts = await this.postRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return posts.map((post) => ({
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

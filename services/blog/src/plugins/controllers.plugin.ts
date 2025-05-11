import { Elysia } from "elysia";
import { createBlogController } from "../controllers/blogs/createBlog.controller";
import { updateBlogController } from "../controllers/blogs/updateBlog.controller";
import { deleteBlogController } from "../controllers/blogs/deleteBlog.controller";
import { getBlogController } from "../controllers/blogs/getBlog.controller";
import { getBlogsController } from "../controllers/blogs/getBlogs.controller";
import { createPostController } from "../controllers/posts/createPost.controller";
import { updatePostController } from "../controllers/posts/updatePost.controller";
import { deletePostController } from "../controllers/posts/deletePost.controller";
import { getPostController } from "../controllers/posts/getPost.controller";
import { getPostsController } from "../controllers/posts/getPosts.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Blogs controllers
  .use(createBlogController)
  .use(updateBlogController)
  .use(deleteBlogController)
  .use(getBlogController)
  .use(getBlogsController)
  // Posts controllers
  .use(createPostController)
  .use(updatePostController)
  .use(deletePostController)
  .use(getPostController)
  .use(getPostsController);
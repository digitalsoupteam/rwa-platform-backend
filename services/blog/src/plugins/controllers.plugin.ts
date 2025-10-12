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
import { withTraceSync } from "@shared/monitoring/src/tracing";
import { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createBlogCtrl = withTraceSync(
    'blog.init.controllers.create_blog',
    () => createBlogController(servicesPlugin)
  );

  const updateBlogCtrl = withTraceSync(
    'blog.init.controllers.update_blog',
    () => updateBlogController(servicesPlugin)
  );

  const deleteBlogCtrl = withTraceSync(
    'blog.init.controllers.delete_blog',
    () => deleteBlogController(servicesPlugin)
  );

  const getBlogCtrl = withTraceSync(
    'blog.init.controllers.get_blog',
    () => getBlogController(servicesPlugin)
  );

  const getBlogsCtrl = withTraceSync(
    'blog.init.controllers.get_blogs',
    () => getBlogsController(servicesPlugin)
  );

  const createPostCtrl = withTraceSync(
    'blog.init.controllers.create_post',
    () => createPostController(servicesPlugin)
  );

  const updatePostCtrl = withTraceSync(
    'blog.init.controllers.update_post',
    () => updatePostController(servicesPlugin)
  );

  const deletePostCtrl = withTraceSync(
    'blog.init.controllers.delete_post',
    () => deletePostController(servicesPlugin)
  );

  const getPostCtrl = withTraceSync(
    'blog.init.controllers.get_post',
    () => getPostController(servicesPlugin)
  );

  const getPostsCtrl = withTraceSync(
    'blog.init.controllers.get_posts',
    () => getPostsController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'blog.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createBlogCtrl)
      .use(updateBlogCtrl)
      .use(deleteBlogCtrl)
      .use(getBlogCtrl)
      .use(getBlogsCtrl)
      .use(createPostCtrl)
      .use(updatePostCtrl)
      .use(deletePostCtrl)
      .use(getPostCtrl)
      .use(getPostsCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>
import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schemas
 */
export const blogSchema = t.Object({
    id: t.String(),
    name: t.String(),
    ownerId: t.String(),
  ownerType: t.String(),
    creator: t.String(),
    parentId: t.String(),
    grandParentId: t.String(),
    createdAt: t.Number(),
    updatedAt: t.Number(),
});

export const postSchema = t.Object({
    id: t.String(),
    blogId: t.String(),
    title: t.String(),
    content: t.String(),
    ownerId: t.String(),
  ownerType: t.String(),
    creator: t.String(),
    parentId: t.String(),
    grandParentId: t.String(),
    createdAt: t.Number(),
    updatedAt: t.Number(),
});

/*
 * Create blog
 */
export const createBlogRequest = t.Pick(blogSchema, [
    "name",
    "ownerId",
  "ownerType",
    "creator",
    "parentId",
    "grandParentId",
]);
export const createBlogResponse = blogSchema;

/*
 * Update blog
 */
export const updateBlogRequest = t.Object({
    id: t.String(),
    updateData: t.Object({
        name: t.String()
    })
});
export const updateBlogResponse = blogSchema;

/*
 * Delete blog
 */
export const deleteBlogRequest = t.Pick(blogSchema, ["id"]);
export const deleteBlogResponse = t.Pick(blogSchema, ["id"]);

/*
 * Get blog
 */
export const getBlogRequest = t.Pick(blogSchema, ["id"]);
export const getBlogResponse = blogSchema;

/*
 * Get blogs by parent ID
 */
export const getBlogsRequest = t.Object({
    filter: t.Record(t.String(), t.Any()),
    sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
    limit: t.Optional(t.Number()),
    offset: t.Optional(t.Number())
});
export const getBlogsResponse = t.Array(blogSchema);

/*
 * Create post
 */
export const createPostRequest = t.Pick(postSchema, [
    'blogId', 
    'title', 
    'content',
    'ownerId',
    'ownerType',
    'creator',
    'parentId',
    'grandParentId',
])
export const createPostResponse = postSchema;

/*
 * Update post
 */
export const updatePostRequest = t.Object({
    id: t.String(),
    updateData: t.Partial(t.Object({
        title: t.String(),
        content: t.String()
    }))
});
export const updatePostResponse = postSchema;

/*
 * Delete post
 */
export const deletePostRequest = t.Pick(postSchema, ["id"]);
export const deletePostResponse = t.Pick(postSchema, ["id"]);

/*
 * Get post
 */
export const getPostRequest = t.Pick(postSchema, ["id"]);
export const getPostResponse = postSchema;

/*
 * Get posts
 */
export const getPostsRequest = t.Object({
    filter: t.Record(t.String(), t.Any()),
    sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
    limit: t.Optional(t.Number()),
    offset: t.Optional(t.Number())
});
export const getPostsResponse = t.Array(postSchema);
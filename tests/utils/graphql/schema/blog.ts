export const CREATE_BLOG = `
  mutation CreateBlog($input: CreateBlogInput!) {
    createBlog(input: $input) {
      id
      name
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BLOG = `
  mutation UpdateBlog($input: UpdateBlogInput!) {
    updateBlog(input: $input) {
      id
      name
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_BLOG = `
  mutation DeleteBlog($id: ID!) {
    deleteBlog(id: $id)
  }
`;

export const GET_BLOG = `
  query GetBlog($id: ID!) {
    getBlog(id: $id) {
      id
      name
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const GET_BLOGS = `
  query GetBlogs($filter: GetBlogsFilterInput) {
    getBlogs(filter: $filter) {
      id
      name
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_POST = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      blogId
      title
      content
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_POST = `
  mutation UpdatePost($input: UpdatePostInput!) {
    updatePost(input: $input) {
      id
      blogId
      title
      content
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_POST = `
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

export const GET_POST = `
  query GetPost($id: ID!) {
    getPost(id: $id) {
      id
      blogId
      title
      content
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const GET_POSTS = `
  query GetPosts($filter: GetPostsFilterInput) {
    getPosts(filter: $filter) {
      id
      blogId
      title
      content
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;
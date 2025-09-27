// Temporary in-memory community store stub.
// Replace with database-backed persistence (Prisma/Postgres/etc.).

export interface CommunityPost {
  id: string;
  topic?: string;
  category?: string;
  content: string;
  createdAt: string;
  likes: string[]; // user ids
  replies: { id: string; content: string; createdAt: string; userId: string }[];
}

export interface CommunityStoreData {
  posts: CommunityPost[];
}

// Singleton mutable store (dev only). In prod, this would be replaced.
const store: CommunityStoreData = {
  posts: []
};

export async function readStore(): Promise<CommunityStoreData> {
  return store;
}

export async function addPost(content: string, userId: string, topic?: string, category?: string) {
  const p: CommunityPost = {
    id: crypto.randomUUID(),
    topic,
    category,
    content,
    createdAt: new Date().toISOString(),
    likes: userId ? [userId] : [], // seed with author like if desired
    replies: []
  };
  store.posts.unshift(p);
  return p;
}

export async function likePost(id: string, userId: string) {
  const p = store.posts.find(p => p.id === id);
  if (!p) return false;
  if (!p.likes.includes(userId)) p.likes.push(userId);
  return true;
}

export async function addReply(postId: string, content: string, userId: string) {
  const p = store.posts.find(p => p.id === postId);
  if (!p) return null;
  const r = { id: crypto.randomUUID(), content, createdAt: new Date().toISOString(), userId };
  p.replies.push(r);
  return r;
}

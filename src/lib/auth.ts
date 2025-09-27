// Temporary auth stub. Replace with real authentication (NextAuth, custom JWT, etc.)
// Provides a server-friendly getSession used in admin pages.

export interface AuthSession {
  id: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
}

// In a real implementation, this would read cookies / headers / tokens.
export async function getSession(): Promise<AuthSession | null> {
  // Simple mock: always return an admin user for now.
  return {
    id: 'admin-1',
    name: 'Administrator',
    email: 'admin@example.com',
    role: 'admin'
  };
}

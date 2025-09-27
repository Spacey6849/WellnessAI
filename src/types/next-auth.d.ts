// Local augmentation for NextAuth to supply minimal runtime types used in project.
// Remove this file once official types resolve correctly.

declare module 'next-auth' {
  interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
  interface Session {
    user?: User;
    accessToken?: string; // added in JWT callback and exposed to client
    expires?: string;
    [key: string]: unknown;
  }
}

declare module 'next-auth/react' {
  import type { Session } from 'next-auth';
  export function getSession(): Promise<Session | null>;
  export function useSession(): { data: Session | null; status: 'loading' | 'authenticated' | 'unauthenticated' };
  export function signIn(provider?: string, options?: Record<string, unknown>): Promise<void> | void;
  export function signOut(options?: Record<string, unknown>): Promise<void> | void;
  export interface SessionProviderProps { children: React.ReactNode; session?: Session | null }
  export function SessionProvider(props: SessionProviderProps): JSX.Element;
}
declare module 'next-auth/react' {
  export function getSession(): Promise<unknown>;
}

declare module 'next-auth' {
  // Minimal placeholder type; real types supplied once dependency installed.
  export type Session = Record<string, unknown>;
}

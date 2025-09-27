import * as NextAuthModule from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// We store refreshed tokens in the JWT; sessions expose accessToken to client components.

interface TokenShape {
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  error?: string;
  [key: string]: unknown;
}

interface AccountShape {
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
  [key: string]: unknown;
}

interface UserShape {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  [key: string]: unknown;
}

async function refreshAccessToken(token: TokenShape): Promise<TokenShape> {
  try {
    const params = new URLSearchParams([
      ['client_id', process.env.GOOGLE_CLIENT_ID || ''],
      ['client_secret', process.env.GOOGLE_CLIENT_SECRET || ''],
      ['grant_type', 'refresh_token'],
      ['refresh_token', token.refreshToken || '']
    ]);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { access_token: string; expires_in: number; refresh_token?: string };
    return {
      ...token,
      accessToken: json.access_token,
      accessTokenExpires: Date.now() + json.expires_in * 1000,
      refreshToken: json.refresh_token || token.refreshToken,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' } as TokenShape;
  }
}

// Export plain object; allow NextAuth to infer types without relying on missing named type exports.
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events'
        }
      }
    })
  ],
  callbacks: {
  async jwt({ token, account, user }: { token: TokenShape; account?: AccountShape; user?: UserShape }) {
      // Initial sign-in
      if (account && user) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: (account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000),
          refreshToken: account.refresh_token,
          user,
        };
      }
      // Return previous token if still valid
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number) - 60_000) {
        return token;
      }
      // Refresh
      return await refreshAccessToken(token);
    },
    async session({ session, token }: { session: { [k: string]: unknown }; token: TokenShape }) {
      (session as { accessToken?: string }).accessToken = token.accessToken;
      (session as { error?: string }).error = token.error;
      return session;
    }
  },
  session: { strategy: 'jwt' },
  pages: {},
};

// Access default export explicitly to satisfy TS when call signatures aren't inferred on synthetic default import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (NextAuthModule as any).default(authOptions);
export { handler as GET, handler as POST };

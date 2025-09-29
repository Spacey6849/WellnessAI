// NextAuth route deprecated. Return 410 Gone for any legacy requests.
export const GET = () => new Response('NextAuth removed', { status: 410 });
export const POST = () => new Response('NextAuth removed', { status: 410 });

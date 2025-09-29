// Google OAuth start route - now handled client-side in booking page
// This route is kept for backwards compatibility but redirects are constructed client-side

export async function GET() {
  return new Response('OAuth flow handled client-side', { status: 200 });
}

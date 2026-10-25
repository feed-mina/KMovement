export const dynamic = 'force-dynamic';

export async function GET() {
    const revision = process.env.KMOVEMENT_RELEASE_SHA ?? '';
    const headers = { 'Cache-Control': 'no-store, max-age=0' };
    if (!/^[0-9a-f]{40}$/.test(revision)) {
        return Response.json({ status: 'unversioned' }, { status: 503, headers });
    }
    return Response.json({ status: 'ok', revision }, { headers });
}

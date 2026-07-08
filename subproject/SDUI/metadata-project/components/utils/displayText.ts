export function normalizeDisplayText(value: unknown): string {
    if (typeof value !== 'string') return value == null ? '' : String(value);

    return value
        .replace(/Google\/Kakao 로그인에서는/g, '소셜 로그인에서는')
        .replace(/자료\/회의록이 없어도\s*/g, '')
        .replace(/\s+—\s+/g, ' — ')
        .trim();
}

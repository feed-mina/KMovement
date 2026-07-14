export function formatKoreanPhoneNumber(value: unknown): string {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function isValidKoreanMobileNumber(value: unknown): boolean {
    return /^01(?:0|1|[6-9])-\d{3,4}-\d{4}$/.test(formatKoreanPhoneNumber(value));
}

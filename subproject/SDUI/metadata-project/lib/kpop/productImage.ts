export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export type Crop = {x: number; y: number; width: number; height: number};
export const FULL_CROP: Crop = {x: 0, y: 0, width: 100, height: 100};

/** Percent coordinates make keyboard selection independent of displayed size. */
export function validCrop(crop: Crop): boolean {
    return Object.values(crop).every(Number.isFinite) && crop.x >= 0 && crop.y >= 0
        && crop.width >= 1 && crop.height >= 1 && crop.x + crop.width <= 100 && crop.y + crop.height <= 100;
}

export async function cropProductImage(url: string, crop: Crop): Promise<Blob> {
    if (!validCrop(crop)) throw new Error('상품 영역을 사진 안으로 맞춰 주세요.');
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25_000_000)
        throw new Error('사진을 2,500만 화소 이하로 줄여 주세요.');
    const width = Math.max(1, Math.round(image.naturalWidth * crop.width / 100));
    const height = Math.max(1, Math.round(image.naturalHeight * crop.height / 100));
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 준비하지 못했어요. 다른 브라우저에서 다시 시도해 주세요.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, image.naturalWidth * crop.x / 100, image.naturalHeight * crop.y / 100,
        width, height, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob)
        : reject(new Error('선택한 상품 부분을 저장하지 못했어요.')), 'image/jpeg', 0.9));
}

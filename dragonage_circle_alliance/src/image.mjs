// Every new upload is decoded and re-encoded as WebP before leaving the browser.
export async function compressImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('JPG·PNG·WebP·GIF 이미지를 선택하세요.');
  if (file.size > 30 * 1048576) throw new Error('원본 이미지는 30MB 이하여야 합니다.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) throw new Error('이미지 크기를 확인하세요.');
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서는 이미지 압축을 사용할 수 없습니다.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') throw new Error('WebP 변환을 지원하는 브라우저로 업로드하세요.');
    if (blob.size > 10485760) throw new Error('압축 후 이미지가 10MB를 초과합니다. 이미지 크기를 줄여주세요.');
    return blob;
  } finally {
    bitmap?.close();
  }
}

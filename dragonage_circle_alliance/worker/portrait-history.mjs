import { fail } from './policy.mjs';

// Keep originals in uploads, like other deleted content, so backups remain restorable.
export async function portraitHistory(old, row, findUpload) {
  const requested = row.extra.portrait_history ?? old?.extra?.portrait_history ?? [];
  if (!Array.isArray(requested) || requested.some(item => !item || typeof item.path !== 'string' || !item.path)) {
    fail('프로필 이미지 목록을 확인하세요.');
  }
  const paths = requested.map(item => item.path);
  if (row.image_path && old?.image_path && old.image_path !== row.image_path &&
      (row.extra.portrait_history === undefined || paths.includes(old.image_path))) paths.push(old.image_path);
  if (row.image_path) paths.push(row.image_path);
  const history = [];
  for (const path of new Set(paths)) {
    const image = await findUpload(path);
    if (!image || image.owner_id !== row.owner_id) fail('본인이 업로드한 프로필 이미지를 선택하세요.', 403);
    history.push({ path, created_at: image.created_at });
  }
  return history.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

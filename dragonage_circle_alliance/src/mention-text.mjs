// Stored mention identifiers belong in links, never in plain-text previews.
export function mentionText(value) {
 return String(value ?? '').replace(/\\([\[\]()])/g,'$1')
  .replace(/@\[([^\]]+)\]\([^\s)]*\)/g,'@$1')
  .replace(/@\[([^\]]+)\]\([^\s)]*$/g,'@$1');
}

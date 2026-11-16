import test from 'node:test';
import assert from 'node:assert/strict';
import { compressImage } from '../src/image.mjs';

test('uploads resize and re-encode every supported format as WebP, keeping transparency', async () => {
  const previous = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
  let closed = 0, canvas, draw;
  globalThis.createImageBitmap = async () => ({ width: 4800, height: 1200, close() { closed++; } });
  globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    canvas = { getContext(type) { assert.equal(type, '2d'); return { drawImage(...args) { draw = args; } }; }, toBlob(done, type, quality) { assert.equal(type, 'image/webp'); assert.equal(quality, 0.82); done(new Blob(['compressed'], { type })); } };
    return canvas;
  } };
  try {
    for (const type of ['image/png','image/jpeg','image/gif','image/webp']) {
      const output = await compressImage(new Blob(['original'], { type }));
      assert.equal(output.type, 'image/webp');
      assert.equal(canvas.width, 2400); assert.equal(canvas.height, 600);
      assert.deepEqual(draw.slice(1), [0, 0, 2400, 600]);
    }
    assert.equal(closed, 4);
    canvas = null;
    await assert.rejects(compressImage(new Blob(['<svg/>'], { type: 'image/svg+xml' })));
    await assert.rejects(compressImage({type:'image/png',size:31*1048576}));
    assert.equal(canvas, null);
    globalThis.document.createElement = () => ({getContext:()=>({drawImage(){}}),toBlob:done=>done(new Blob(['fallback'],{type:'image/png'}))});
    await assert.rejects(compressImage(new Blob(['image'],{type:'image/png'})), /WebP/);
    assert.equal(closed,5);
  } finally { globalThis.document=previous.document; globalThis.createImageBitmap=previous.createImageBitmap; }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { compressImage, validateAttachments } from '../src/image.mjs';

test('uploads resize and re-encode non-GIF images as WebP', async () => {
  const previous = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
  let closed = 0, canvas, draw;
  globalThis.createImageBitmap = async () => ({ width: 4800, height: 1200, close() { closed++; } });
  globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    canvas = { getContext(type) { assert.equal(type, '2d'); return { drawImage(...args) { draw = args; } }; }, toBlob(done, type, quality) { assert.equal(type, 'image/webp'); assert.equal(quality, 0.82); done(new Blob(['compressed'], { type })); } };
    return canvas;
  } };
  try {
    for (const type of ['image/png','image/jpeg','image/webp']) {
      const output = await compressImage(new Blob(['original'], { type }));
      assert.equal(output.type, 'image/webp');
      assert.equal(canvas.width, 2400); assert.equal(canvas.height, 600);
      assert.deepEqual(draw.slice(1), [0, 0, 2400, 600]);
    }
    assert.equal(closed, 3);
    canvas = null;
    await assert.rejects(compressImage(new Blob(['<svg/>'], { type: 'image/svg+xml' })));
    await assert.rejects(compressImage({type:'image/png',size:31*1048576}));
    assert.equal(canvas, null);
    globalThis.document.createElement = () => ({getContext:()=>({drawImage(){}}),toBlob:done=>done(new Blob(['fallback'],{type:'image/png'}))});
    await assert.rejects(compressImage(new Blob(['image'],{type:'image/png'})), /WebP/);
    assert.equal(closed,4);
  } finally { globalThis.document=previous.document; globalThis.createImageBitmap=previous.createImageBitmap; }
});

test('GIF uploads keep the original bytes and enforce the uncompressed size limit', async () => {
  const gif = new Blob(['GIF89a animated original'], {type:'image/gif'});
  assert.equal(await compressImage(gif), gif);
  await assert.rejects(compressImage({type:'image/gif',size:10485761}), /10MB/);
});
test('attachment cap counts saved and new images across repeated selection', () => {
  const file = {type:'image/png',size:100,name:'test.png'};
  assert.doesNotThrow(() => validateAttachments(Array(3).fill(file), 7));
  assert.throws(() => validateAttachments(Array(4).fill(file), 7), /10/);
  assert.throws(() => validateAttachments([file], 10), /10/);
  assert.throws(() => validateAttachments([{...file,type:'image/gif',size:10485761}]), /10MB/);
});

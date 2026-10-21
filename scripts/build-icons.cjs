// Preserve the supplied full-color artwork; format it for app and Windows icons.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true, timeout: 30000 });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else {
  const { app, nativeImage } = require('electron');
  app.whenReady().then(() => {
    const source = nativeImage.createFromPath(path.join(root, 'resources', 'logo.png'));
    if (source.isEmpty()) throw new Error('The Cawal logo could not be read.');
    const { width, height } = source.getSize();
    const bitmap = source.toBitmap();
    // Remove only white background connected to the outside of the image.
    // Enclosed white details, including the laptop screen, remain untouched.
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let read = 0, write = 0;
    const enqueue = index => {
      if (visited[index]) return;
      visited[index] = 1;
      const offset = index * 4;
      if (bitmap[offset + 3] === 0 || (bitmap[offset] >= 245 && bitmap[offset + 1] >= 245 && bitmap[offset + 2] >= 245)) queue[write++] = index;
    };
    for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
    while (read < write) {
      const index = queue[read++];
      bitmap.fill(0, index * 4, index * 4 + 4);
      const x = index % width, y = Math.floor(index / width);
      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y < height - 1) enqueue(index + width);
    }
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (bitmap[(y * width + x) * 4 + 3] > 0) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) throw new Error('The supplied logo contains no visible artwork.');
    const brand = nativeImage.createFromBitmap(bitmap, { width, height }).crop({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
    fs.writeFileSync(path.join(root, 'resources', 'brand.png'), brand.toPNG());
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const icons = sizes.map(size => brand.resize({ width: size, height: size, quality: 'best' }).toPNG());
    fs.writeFileSync(path.join(root, 'resources', 'icon.png'), icons[icons.length - 1]);
    const header = Buffer.alloc(6 + 16 * sizes.length);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    icons.forEach((png, index) => {
      const entry = 6 + index * 16;
      header[entry] = sizes[index] === 256 ? 0 : sizes[index];
      header[entry + 1] = header[entry];
      header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
      offset += png.length;
    });
    fs.writeFileSync(path.join(root, 'resources', 'icon.ico'), Buffer.concat([header, ...icons]));
    console.log('Cawal full-color branding exported: app artwork, PNG, and seven Windows icon sizes.');
    app.exit(0);
  }).catch(error => { console.error(error); app.exit(1); });
}

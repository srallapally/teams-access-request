import { mkdir, writeFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

async function main() {
  const outputDir = path.join(process.cwd(), 'dist', 'manifest');
  await mkdir(outputDir, { recursive: true });

  const zipPath = path.join(outputDir, 'manifest.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = createWriteStream(zipPath);

  const manifestPath = path.join('appManifest', 'manifest.json');
  await writeFile(path.join(outputDir, 'README.txt'), 'Upload this ZIP to Teams to sideload the app.');

  archive.file(manifestPath, { name: 'manifest.json' });
  archive.directory('appManifest/images/', '');
  archive.file(path.join(outputDir, 'README.txt'), { name: 'README.txt' });
  archive.finalize();

  await pipeline(archive, stream);
  console.log(`Manifest packaged at ${zipPath}`);
}

void main();

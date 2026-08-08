import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import sharp from 'sharp';

import { unsupportedMedia } from '../lib/errors.js';

const MAX_LONG_SIDE = 1600;

/**
 * What the bundled sharp binary can actually decode. HEIC is absent on purpose: the prebuilt
 * binary ships without a HEIC decoder for licensing reasons. iOS Safari converts HEIC to JPEG
 * when a photo is picked through a file input, so this is not a dead end on a phone.
 */
const ACCEPTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff']);

export function createPhotoService(uploadDir: string) {
  const directory = resolve(uploadDir);
  const pathFor = (brewId: string): string => join(directory, `${brewId}.webp`);

  return {
    pathFor,

    /**
     * Re-encodes to WebP and drops every piece of metadata. Phone photos carry GPS
     * coordinates in EXIF — for a cup photographed at home, that is the owner's address.
     * The original file is never written to disk.
     */
    async store(brewId: string, input: Buffer): Promise<string> {
      await mkdir(directory, { recursive: true });

      const image = sharp(input, { failOn: 'error' });

      // The format comes from the bytes, not from the filename or the client's content type.
      const { format } = await image.metadata().catch(() => {
        throw unsupportedMedia('File is not a readable image');
      });

      if (!ACCEPTED_FORMATS.has(format)) {
        throw unsupportedMedia(`Unsupported image format: ${format}`);
      }

      const output = await image
        // Applies EXIF orientation before the metadata is discarded, otherwise portrait
        // photos would come out rotated.
        .rotate()
        .resize({
          width: MAX_LONG_SIDE,
          height: MAX_LONG_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();

      const path = pathFor(brewId);
      await writeFile(path, output);

      return path;
    },

    async remove(brewId: string): Promise<void> {
      try {
        await unlink(pathFor(brewId));
      } catch {
        // Already gone is the desired end state, not an error worth surfacing.
      }
    },
  };
}

export type PhotoService = ReturnType<typeof createPhotoService>;

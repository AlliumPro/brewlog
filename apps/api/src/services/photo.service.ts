import { eq } from 'drizzle-orm';
import sharp from 'sharp';

import type { Db } from '../db/client.js';
import { brewPhotos } from '../db/schema.js';
import { unsupportedMedia } from '../lib/errors.js';

const MAX_LONG_SIDE = 1600;

/**
 * What the bundled sharp binary can actually decode. HEIC is absent on purpose: the prebuilt
 * binary ships without a HEIC decoder for licensing reasons. iOS Safari converts HEIC to JPEG
 * when a photo is picked through a file input, so this is not a dead end on a phone.
 */
const ACCEPTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff']);

/**
 * Photos are rows, not files: the host has no persistent disk. Ownership is not checked here —
 * callers resolve the brew through the owner-scoped repository first, and only then ask for
 * its photo by brew id.
 */
export function createPhotoService(db: Db) {
  return {
    /**
     * Re-encodes to WebP and drops every piece of metadata. Phone photos carry GPS
     * coordinates in EXIF — for a cup photographed at home, that is the owner's address.
     * The original is never stored.
     */
    async store(brewId: string, input: Buffer): Promise<void> {
      const image = sharp(input, { failOn: 'error' });

      // The format comes from the bytes, not from the filename or the client's content type.
      const { format } = await image.metadata().catch(() => {
        throw unsupportedMedia('File is not a readable image');
      });

      if (!ACCEPTED_FORMATS.has(format)) {
        throw unsupportedMedia(`Unsupported image format: ${format}`);
      }

      const data = await image
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

      await db
        .insert(brewPhotos)
        .values({ brewId, data })
        .onConflictDoUpdate({ target: brewPhotos.brewId, set: { data } });
    },

    async read(brewId: string): Promise<Buffer | undefined> {
      const [row] = await db
        .select({ data: brewPhotos.data })
        .from(brewPhotos)
        .where(eq(brewPhotos.brewId, brewId))
        .limit(1);

      return row?.data;
    },

    async remove(brewId: string): Promise<void> {
      await db.delete(brewPhotos).where(eq(brewPhotos.brewId, brewId));
    },
  };
}

export type PhotoService = ReturnType<typeof createPhotoService>;

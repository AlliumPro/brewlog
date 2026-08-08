import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../app.js';
import { createTestApp, login, multipartBody, sampleBrew } from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

describe('photos', () => {
  let context: TestContext;
  let app: App;
  let cookie: string;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
    cookie = await login(app);
  });

  afterAll(async () => {
    await context.close();
  });

  const createBrew = async (): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/brews',
      headers: { cookie },
      payload: sampleBrew(),
    });

    return response.json().id;
  };

  /** A real PNG carrying EXIF, so the metadata-stripping claim is actually exercised. */
  const makePng = async (): Promise<Buffer> =>
    sharp({
      create: { width: 40, height: 24, channels: 3, background: { r: 201, g: 104, b: 63 } },
    })
      .withExif({ IFD0: { Copyright: 'BrewLog test', ImageDescription: 'secret location' } })
      .png()
      .toBuffer();

  it('attaches a photo, exposes it through the authenticated route and strips metadata', async () => {
    const id = await createBrew();
    const { payload, contentType } = multipartBody(await makePng(), 'cup.png', 'image/png');

    const uploaded = await app.inject({
      method: 'PUT',
      url: `/api/brews/${id}/photo`,
      headers: { cookie, 'content-type': contentType },
      payload,
    });

    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json().photoUrl).toBe(`/api/brews/${id}/photo`);

    const fetched = await app.inject({
      method: 'GET',
      url: `/api/brews/${id}/photo`,
      headers: { cookie },
    });

    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers['content-type']).toBe('image/webp');
    expect(fetched.headers['cache-control']).toContain('private');

    const stored = await sharp(fetched.rawPayload).metadata();

    expect(stored.format).toBe('webp');
    // EXIF carries GPS on phone photos; it must not survive the re-encode.
    expect(stored.exif).toBeUndefined();
  });

  it('refuses a file that is not an image with 415', async () => {
    const id = await createBrew();
    const { payload, contentType } = multipartBody(
      Buffer.from('this is not an image at all', 'utf8'),
      'notes.txt',
      // A lying content type must not help: the format is sniffed from the bytes.
      'image/png',
    );

    const response = await app.inject({
      method: 'PUT',
      url: `/api/brews/${id}/photo`,
      headers: { cookie, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(415);
  });

  it('answers 404 for a brew without a photo and for an unknown brew', async () => {
    const id = await createBrew();

    const noPhoto = await app.inject({
      method: 'GET',
      url: `/api/brews/${id}/photo`,
      headers: { cookie },
    });

    expect(noPhoto.statusCode).toBe(404);
    expect(noPhoto.json().error.message).toBe('Photo not found');

    const noBrew = await app.inject({
      method: 'GET',
      url: '/api/brews/01900000-0000-7000-8000-000000000000/photo',
      headers: { cookie },
    });

    expect(noBrew.statusCode).toBe(404);
    expect(noBrew.json().error.message).toBe('Brew not found');
  });

  it('detaches a photo and reports it missing afterwards', async () => {
    const id = await createBrew();
    const { payload, contentType } = multipartBody(await makePng(), 'cup.png', 'image/png');

    await app.inject({
      method: 'PUT',
      url: `/api/brews/${id}/photo`,
      headers: { cookie, 'content-type': contentType },
      payload,
    });

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/brews/${id}/photo`,
      headers: { cookie },
    });

    expect(removed.statusCode).toBe(204);

    const again = await app.inject({
      method: 'DELETE',
      url: `/api/brews/${id}/photo`,
      headers: { cookie },
    });

    expect(again.statusCode).toBe(404);
  });

  it('requires a session to read a photo', async () => {
    const id = await createBrew();

    const response = await app.inject({ method: 'GET', url: `/api/brews/${id}/photo` });

    expect(response.statusCode).toBe(401);
  });
});

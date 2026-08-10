const request = require('supertest');

/**
 * Gallery image upload — the one write path with no coverage at all (`IMP-014` / `IMP-075` Step B).
 *
 * **Why this file exists now.** The framework upgrade preparation pass
 * (`docs/FRAMEWORK_UPGRADE_PLAN.md`) had to record that the `cloudinary` 1 → 2 major is the only
 * step whose success could not be demonstrated by running the suite: nothing here contained a
 * multipart request, an `.attach()`, or a stub for the Cloudinary client. The `cloudinary` advisory
 * is *"Arbitrary Argument Injection through parameters that include an ampersand"*, and this
 * endpoint passes a user-supplied caption and filename into an upload — so "verify by clicking" was
 * a bad answer for exactly this path.
 *
 * **Where the boundary is.** Only `uploadImage` is mocked. Multer is real, so the multipart parse,
 * the disk staging, the extension/mimetype agreement check and the magic-byte content sniff all
 * execute for real against a real Postgres. What is faked is the network call to a third party —
 * the same boundary `AuthContext.test.jsx` draws around Firebase, and for the same reason: their
 * SDK working is their test suite's job, ours calling it correctly is this one's.
 */

// `mock`-prefixed so Jest's hoisted factory may close over it — the factory runs before
// module scope is initialised, and that prefix is the documented opt-out.
const mockUploadImage = jest.fn();
jest.mock('../src/config/cloudinary', () => ({
  cloudinary: { uploader: {} },
  uploadImage: (...args) => mockUploadImage(...args),
  destroyImage: jest.fn(async () => ({ result: 'ok' })),
  destroyPlaceAssets: jest.fn(async () => ({})),
  publicIdFromUrl: jest.fn(() => null)
}));

const app = require('../app');
const { createSchema, resetData, closeDb, resetRateLimits, pool } = require('./helpers/testDb');
const { authHeader } = require('./helpers/firebaseMock');

const asAdmin = { Authorization: authHeader({ uid: 'seed-admin-uid' }) };
const asUser = { Authorization: authHeader({ uid: 'seed-user-uid' }) };

/**
 * Real file headers, because `inspectFileContents` reads the first 12 bytes and does not care what
 * the client claimed. A fixture of arbitrary bytes would be rejected before reaching the controller,
 * and the test would pass for the wrong reason.
 */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1)
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 1)]);

/** Place 2 (Coorg) has no gallery rows in the seed — place 1 does, so ordering starts dirty there. */
const EMPTY_GALLERY_PLACE = 2;

const upload = (
  placeId,
  { buffer = PNG, filename = 'shot.png', type = 'image/png', caption, headers = asAdmin } = {}
) => {
  let req = request(app).post(`/api/admin/places/${placeId}/images`).set(headers);
  if (caption !== undefined) req = req.field('caption', caption);
  return req.attach('image', buffer, { filename, contentType: type });
};

beforeAll(async () => {
  await createSchema();
});
beforeEach(async () => {
  await resetData();
  resetRateLimits(app);
  mockUploadImage.mockReset();
  mockUploadImage.mockResolvedValue({
    url: 'https://res.cloudinary.com/demo/image/upload/v1/easytrip/places/2/uploaded.png',
    public_id: 'easytrip/places/2/uploaded'
  });
});
afterAll(async () => {
  await closeDb();
});

const galleryOf = async (placeId) =>
  (
    await pool.query(
      'SELECT id, image_url, caption, display_order FROM place_images WHERE place_id = $1 ORDER BY display_order',
      [placeId]
    )
  ).rows;

describe('who may add a gallery image', () => {
  test('an anonymous request is refused', async () => {
    const res = await request(app)
      .post(`/api/admin/places/${EMPTY_GALLERY_PLACE}/images`)
      .attach('image', PNG, { filename: 'shot.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
    expect(await galleryOf(EMPTY_GALLERY_PLACE)).toHaveLength(0);
  });

  test('a signed-in non-admin is refused', async () => {
    const res = await upload(EMPTY_GALLERY_PLACE, { headers: asUser });
    expect(res.status).toBe(403);
    // The point of asserting the table too: a 403 that still wrote a row would be a worse bug than
    // a 200, and the status alone cannot tell the difference.
    expect(await galleryOf(EMPTY_GALLERY_PLACE)).toHaveLength(0);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

describe('a successful upload', () => {
  test('stores the URL Cloudinary returned, not one the client supplied', async () => {
    const res = await upload(EMPTY_GALLERY_PLACE, { caption: 'Coffee country' });

    expect(res.status).toBe(201);
    const rows = await galleryOf(EMPTY_GALLERY_PLACE);
    expect(rows).toHaveLength(1);
    expect(rows[0].image_url).toBe(
      'https://res.cloudinary.com/demo/image/upload/v1/easytrip/places/2/uploaded.png'
    );
    expect(rows[0].caption).toBe('Coffee country');
  });

  test('files the asset under the place, which is what makes cascade deletion work', async () => {
    await upload(EMPTY_GALLERY_PLACE);

    // `destroyPlaceAssets` removes a whole place's images by folder prefix rather than by tracking
    // individual public_ids, so the folder is load-bearing — an upload filed elsewhere would be
    // orphaned in Cloudinary forever when the place is deleted.
    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ folder: `easytrip/places/${EMPTY_GALLERY_PLACE}` })
    );
  });

  test('a blank caption is stored as NULL rather than an empty string', async () => {
    await upload(EMPTY_GALLERY_PLACE, { caption: '   ' });
    expect((await galleryOf(EMPTY_GALLERY_PLACE))[0].caption).toBeNull();
  });

  test('images queue in the order they arrive', async () => {
    await upload(EMPTY_GALLERY_PLACE, { caption: 'first' });
    await upload(EMPTY_GALLERY_PLACE, { caption: 'second' });

    // `COALESCE(MAX(display_order), -1) + 1` has a distinct branch for the very first row, where
    // MAX over no rows is NULL. Both branches run here, in order.
    const rows = await galleryOf(EMPTY_GALLERY_PLACE);
    expect(rows.map((r) => [r.caption, r.display_order])).toEqual([
      ['first', 0],
      ['second', 1]
    ]);
  });
});

describe('what is refused, and whether it costs an upload', () => {
  test('a request with no file attached is a 400', async () => {
    const res = await request(app)
      .post(`/api/admin/places/${EMPTY_GALLERY_PLACE}/images`)
      .set(asAdmin)
      .field('caption', 'no file here');
    expect(res.status).toBe(400);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test('an unknown place is rejected BEFORE anything is uploaded', async () => {
    const res = await upload(999999);

    expect(res.status).toBe(404);
    // The ordering is the assertion. Uploading first and checking the place afterwards would leave
    // a paid-for asset in Cloudinary with no row referencing it and nothing to clean it up —
    // invisible from the app, and permanent.
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test('an SVG is refused on its extension — it is script-capable markup', async () => {
    const res = await upload(EMPTY_GALLERY_PLACE, {
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      filename: 'payload.svg',
      type: 'image/svg+xml'
    });
    expect(res.status).toBe(400);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test('contents are trusted over the claimed type', async () => {
    // A JPEG body wearing a .png name and an image/png content-type. Both client-supplied fields
    // agree with each other and both are wrong; only reading the magic bytes catches it.
    const res = await upload(EMPTY_GALLERY_PLACE, { buffer: JPEG, filename: 'shot.png' });

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.message ?? res.body.message).toMatch(/do not match|not a valid/i);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test('a file that is not an image at all is refused', async () => {
    const res = await upload(EMPTY_GALLERY_PLACE, {
      buffer: Buffer.from('MZ\x90\x00 this is an executable, not a picture'),
      filename: 'trojan.png'
    });
    expect(res.status).toBe(400);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

import { ConfigService } from '@nestjs/config';
import { familyMailSettings, sendFamilyAccessCode } from './family-mail';

const settings = {
  FAMILY_MAIL_PROVIDER: 'resend',
  FAMILY_MAIL_FROM: 'Alegria <fiction@example.test>',
  FAMILY_RESEND_API_KEY: 'test-key-not-real',
};
afterEach(() => vi.unstubAllGlobals());
describe('Family mail transport, no network sends in tests', () => {
  it('uses the fixed HTTPS endpoint, explicit family key, text-only recipient and idempotency key', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'fictional-provider-id' }) });
    vi.stubGlobal('fetch', fetcher);
    await sendFamilyAccessCode(
      new ConfigService(settings),
      'parent@example.test',
      '12345678',
      'challenge-test',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request.redirect).toBe('error');
    expect(request.headers.Authorization).toBe('Bearer test-key-not-real');
    expect(request.headers['Idempotency-Key']).toBe('alegria-family-access-challenge-test');
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body)).toEqual({
      from: settings.FAMILY_MAIL_FROM,
      to: ['parent@example.test'],
      subject: 'Votre accès aux inscriptions Alegria',
      text: expect.stringContaining('12345678'),
    });
  });
  it.each([400, 401, 403, 429, 500])(
    'fails closed on HTTP%s, with no SMTP fallback or automatic retry',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue({ ok: false, status });
      vi.stubGlobal('fetch', fetcher);
      await expect(
        sendFamilyAccessCode(
          new ConfigService(settings),
          'parent@example.test',
          '12345678',
          'test',
        ),
      ).rejects.toThrow('rejected');
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([{}, { id: '' }, { id: 123 }, null])(
    'rejects a success without message acknowledgment: %j',
    async (data) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
      await expect(
        sendFamilyAccessCode(
          new ConfigService(settings),
          'parent@example.test',
          '12345678',
          'test',
        ),
      ).rejects.toThrow('acknowledge');
    },
  );
  it('propagates network timeouts without retrying', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      sendFamilyAccessCode(new ConfigService(settings), 'parent@example.test', '12345678', 'test'),
    ).rejects.toThrow('timeout');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...settings, FAMILY_RESEND_API_KEY: '' },
    { ...settings, FAMILY_RESEND_API_KEY: undefined, RESEND_API_KEY: 'lyam-must-not-be-used' },
    { ...settings, FAMILY_MAIL_FROM: 'invalid\r\nBcc:other@example.test' },
    { ...settings, FAMILY_MAIL_PROVIDER: 'unknown' },
    { ...settings, FAMILY_MAIL_FROM: '' },
  ])('refuses incomplete, ambiguous or injected config without network', async (values) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(() => familyMailSettings(new ConfigService(values))).toThrow('pas encore configuré');
    await expect(
      sendFamilyAccessCode(new ConfigService(values), 'parent@example.test', '12345678', 'test'),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('refuses other preview recipients before any network call', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const cfg = new ConfigService({
    ...settings,
    FAMILY_PREVIEW_DEMO_ENABLED: 'pr42-fictional-only',
    RENDER_SERVICE_NAME: 'al-pr42-api',
    RENDER_GIT_BRANCH: 'feat/family-registration',
    RENDER_EXTERNAL_HOSTNAME: 'al-pr42-api.onrender.com',
    FAMILY_PREVIEW_MAIL_ENABLED: 'owner-only-test',
    FAMILY_PREVIEW_MAIL_TO: 'emmanueldesaintsteban@gmail.com',
  });
  await expect(
    sendFamilyAccessCode(cfg, 'thirdparty@example.test', '12345678', 'fiction'),
  ).rejects.toThrow('non autorisé');
  expect(fetcher).not.toHaveBeenCalled();
});

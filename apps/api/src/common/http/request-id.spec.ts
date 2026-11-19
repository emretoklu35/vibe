import { resolveRequestId } from './request-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('başlık yoksa UUID üretir', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID);
  });

  it('güvenli kimliği aynen kullanır', () => {
    expect(resolveRequestId('mobile.req-0001_x')).toBe('mobile.req-0001_x');
  });

  it.each(['kisa', 'a'.repeat(65), 'satir\nsonu', 'bosluk var  ', '<script>xx</script>'])(
    'güvensiz kimliği (%j) reddeder',
    (value) => {
      expect(resolveRequestId(value)).toMatch(UUID);
    },
  );

  it('dizi başlıkta ilk değeri değerlendirir', () => {
    expect(resolveRequestId(['first-id-123', 'second-id-456'])).toBe('first-id-123');
  });
});

import { Writable } from 'node:stream';

import { pino } from 'pino';

import { REDACTION_CENSOR, REDACT_PATHS } from './redaction.js';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: REDACTION_CENSOR } }, stream);
  return { logger, output: () => lines.join('') };
}

describe('log redaksiyonu', () => {
  it('yetkilendirme başlığını ve çerezleri gizler', () => {
    const { logger, output } = captureLogger();
    logger.info({ req: { headers: { authorization: 'Bearer gizli-token', cookie: 'sid=abc' } } });
    expect(output()).not.toContain('gizli-token');
    expect(output()).not.toContain('sid=abc');
  });

  it('kök, birinci ve ikinci seviyedeki hassas alanları gizler', () => {
    const { logger, output } = captureLogger();
    logger.info({
      phone: '+905551112233',
      user: { refreshToken: 'rt-123', lat: 41.0082 },
      ctx: { dto: { otpCode: '123456', body: 'özel mesaj metni' } },
    });
    const text = output();
    for (const secret of ['5551112233', 'rt-123', '41.0082', '123456', 'özel mesaj']) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain(REDACTION_CENSOR);
  });

  it('hata kodlarını (err.code) teşhis için korur', () => {
    const { logger, output } = captureLogger();
    logger.error({ err: { code: 'ECONNREFUSED' } });
    expect(output()).toContain('ECONNREFUSED');
  });
});

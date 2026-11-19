import { parseTargetType, REPORT_REASONS, reportTitle } from '../report-reasons';

describe('şikayet nedenleri', () => {
  it('her neden bir kez ve en ağır olan önce listelenir', () => {
    const values = REPORT_REASONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values[0]).toBe('UNDERAGE');
    expect(values.at(-1)).toBe('OTHER');
  });

  it('başlık hedef türüne göre kurulur', () => {
    expect(reportTitle('Ayşe', 'MESSAGE')).toBe('Ayşe adlı kişinin mesajını');
    expect(reportTitle(undefined, 'PROFILE')).toBe('Bu kişinin profilini');
  });

  it('bilinmeyen hedef türü profile düşer', () => {
    expect(parseTargetType('MESSAGE')).toBe('MESSAGE');
    expect(parseTargetType('DROP TABLE')).toBe('PROFILE');
    expect(parseTargetType(undefined)).toBe('PROFILE');
  });
});

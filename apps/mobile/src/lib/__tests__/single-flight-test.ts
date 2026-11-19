import { singleFlight } from '../single-flight';

describe('singleFlight', () => {
  it('eşzamanlı çağrılar tek işlemi paylaşır', async () => {
    let calls = 0;
    let release!: () => void;
    const run = singleFlight(
      () =>
        new Promise<number>((resolve) => {
          calls += 1;
          release = () => resolve(calls);
        }),
    );
    const [a, b] = [run(), run()];
    release();
    await expect(Promise.all([a, b])).resolves.toEqual([1, 1]);
    expect(calls).toBe(1);
  });

  it('işlem bitince sonraki çağrı yeni işlem başlatır (hata sonrası da)', async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
      if (calls === 1) throw new Error('ilk deneme');
      return calls;
    });
    await expect(run()).rejects.toThrow('ilk deneme');
    await expect(run()).resolves.toBe(2);
  });
});

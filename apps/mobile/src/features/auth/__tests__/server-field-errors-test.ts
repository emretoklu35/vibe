import { ApiError } from '@/api/client';

import { applyServerFieldErrors } from '../server-field-errors';

type Form = { displayName: string; bio: string };

describe('applyServerFieldErrors', () => {
  it('VALIDATION_FAILED ayrıntılarını bilinen alanlara yazar', () => {
    const setError = jest.fn();
    const error = new ApiError(400, 'VALIDATION_FAILED', 'İstek doğrulanamadı', 'r1', [
      { field: 'displayName', messages: ['displayName yalnızca harf içerebilir'] },
      { field: 'unknownField', messages: ['x'] },
    ]);
    expect(applyServerFieldErrors<Form>(error, setError, ['displayName', 'bio'])).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(
      'displayName',
      expect.objectContaining({ type: 'server' }),
    );
  });

  it('başka hata kodlarında dokunmaz', () => {
    const setError = jest.fn();
    expect(
      applyServerFieldErrors<Form>(new ApiError(409, 'PROFILE_REQUIRED', 'x'), setError, ['bio']),
    ).toBe(false);
    expect(applyServerFieldErrors<Form>(new Error('ağ'), setError, ['bio'])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});

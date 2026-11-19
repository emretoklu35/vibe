import type { ValidationError } from '@nestjs/common';

import { flattenValidationErrors } from './validation.pipe.js';

describe('flattenValidationErrors', () => {
  it('iç içe hataları noktalı alan yoluyla düzleştirir', () => {
    const errors = [
      { property: 'age', constraints: { min: 'age must not be less than 18' }, children: [] },
      {
        property: 'profile',
        children: [
          {
            property: 'photos',
            children: [{ property: '0', constraints: { isUrl: 'must be a URL' }, children: [] }],
          },
        ],
      },
    ] as ValidationError[];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'age', messages: ['age must not be less than 18'] },
      { field: 'profile.photos.0', messages: ['must be a URL'] },
    ]);
  });
});

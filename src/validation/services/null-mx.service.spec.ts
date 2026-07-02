import { NullMxService } from './null-mx.service';

describe('NullMxService', () => {
  const service = new NullMxService();

  it('detects a null MX ("." with a single record)', () => {
    expect(service.isNullMx([{ exchange: '.', priority: 0 }])).toBe(true);
  });

  it('treats an empty-string exchange as null MX', () => {
    expect(service.isNullMx([{ exchange: '', priority: 0 }])).toBe(true);
  });

  it('is not null MX for a real record', () => {
    expect(
      service.isNullMx([{ exchange: 'mx.example.com', priority: 10 }]),
    ).toBe(false);
  });

  it('is not null MX for multiple records', () => {
    expect(
      service.isNullMx([
        { exchange: '.', priority: 0 },
        { exchange: 'mx.example.com', priority: 10 },
      ]),
    ).toBe(false);
  });

  it('is not null MX for an empty list', () => {
    expect(service.isNullMx([])).toBe(false);
  });
});

import { TypoSuggestionService } from './typo-suggestion.service';

describe('TypoSuggestionService', () => {
  const service = new TypoSuggestionService();

  describe('detects typos of popular providers', () => {
    const cases: Array<[string, string]> = [
      ['gmial.com', 'gmail.com'],
      ['gamil.com', 'gmail.com'],
      ['gmal.com', 'gmail.com'],
      ['gmaill.com', 'gmail.com'],
      ['hotmal.com', 'hotmail.com'],
      ['outlok.com', 'outlook.com'],
      ['outllook.com', 'outlook.com'],
      ['yaho.com', 'yahoo.com'],
      ['yahooo.com', 'yahoo.com'],
      ['protonmal.com', 'protonmail.com'],
    ];

    it.each(cases)('%s -> %s', (input, expected) => {
      expect(service.suggest(input)).toBe(expected);
    });
  });

  it('returns null for an exact provider match', () => {
    expect(service.suggest('gmail.com')).toBeNull();
  });

  it('returns null for an unrelated domain', () => {
    expect(service.suggest('xyzfakedomain99.com')).toBeNull();
    expect(service.suggest('mycompany.io')).toBeNull();
  });
});

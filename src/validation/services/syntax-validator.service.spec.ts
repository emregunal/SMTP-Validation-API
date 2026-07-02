import { SyntaxValidatorService } from './syntax-validator.service';

describe('SyntaxValidatorService', () => {
  const service = new SyntaxValidatorService();

  describe('invalid addresses', () => {
    const invalid = [
      'invalid-email',
      '@gmail.com',
      'user@',
      'user@@gmail.com',
      'user@gmail..com',
      'user@.com',
      'user@com',
      'user name@gmail.com',
      '',
    ];

    it.each(invalid)('rejects "%s"', (email) => {
      const result = service.validate(email);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('valid addresses', () => {
    const valid = [
      'user@example.com',
      'user+tag@gmail.com',
      'first.last@gmail.com',
      'user_name@gmail.com',
      'user-name@gmail.com',
      'a@b.co',
    ];

    it.each(valid)('accepts "%s"', (email) => {
      expect(service.validate(email).valid).toBe(true);
    });
  });
});

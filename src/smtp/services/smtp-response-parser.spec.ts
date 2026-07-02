import { SmtpResponseParser } from './smtp-response-parser';

describe('SmtpResponseParser', () => {
  const parser = new SmtpResponseParser();

  it('parses a basic 250 OK response', () => {
    const result = parser.parse(
      'unknown',
      '250 2.1.5 OK',
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('accepted');
    expect(result.code).toBe(250);
    expect(result.enhancedCode).toBe('2.1.5');
    expect(result.message).toBe('OK');
  });

  it('parses a 550 User unknown response', () => {
    const result = parser.parse(
      'unknown',
      "550-5.1.1 The email account that you tried to reach does not exist.\r\n550 5.1.1 Please try double-checking the recipient's email address.",
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('rejected');
    expect(result.code).toBe(550);
    expect(result.enhancedCode).toBe('5.1.1');
    expect(result.mailboxNotFound).toBe(true);
  });

  it('treats a bare/ambiguous 5xx as rejected but NOT mailbox-not-found', () => {
    const result = parser.parse(
      'unknown',
      '550 Requested action not taken',
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('rejected');
    expect(result.mailboxNotFound).toBe(false);
  });

  it('classifies a 5.7.x enhanced code as a policy block', () => {
    const result = parser.parse(
      'unknown',
      '550 5.7.1 Recipient not authorized',
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('blocked');
  });

  it('detects policy block from code 554', () => {
    const result = parser.parse(
      'unknown',
      '554 5.7.1 Message rejected under policy',
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('blocked');
    expect(result.code).toBe(554);
    expect(result.message).toContain('Message rejected under policy');
  });

  it('detects policy block from message text', () => {
    const result = parser.parse(
      'unknown',
      '550 5.7.1 Service unavailable; Client host [x.x.x.x] blocked using Spamhaus',
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('blocked'); // Blocked because of "blocked" in message
  });

  it('identifies 4xx as tempfail', () => {
    const result = parser.parse(
      'unknown',
      '450 4.2.1 The user you are trying to contact is receiving mail at a rate that prevents additional messages from being delivered',
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('tempfail');
    expect(result.code).toBe(450);
  });

  it('handles empty raw message', () => {
    const result = parser.parse(
      'connection_failed',
      null,
      'unknown',
      'unknown',
      'mx.test',
      100,
    );
    expect(result.status).toBe('connection_failed');
    expect(result.code).toBeNull();
  });
});

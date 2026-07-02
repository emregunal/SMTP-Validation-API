import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import { SmtpValidatorService } from './smtp-validator.service';
import { SmtpResponseParser } from './smtp-response-parser';

jest.mock('net');

describe('SmtpValidatorService', () => {
  let service: SmtpValidatorService;
  let mockSocket: any;

  beforeEach(async () => {
    mockSocket = {
      setTimeout: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
    };

    (net.createConnection as jest.Mock).mockReturnValue(mockSocket);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SmtpValidatorService,
        SmtpResponseParser,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              enabled: true,
              connectTimeoutMs: 1000,
              readTimeoutMs: 1000,
              ehloName: 'test.com',
              mailFrom: 'probe@test.com',
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SmtpValidatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips validation if disabled', async () => {
    const moduleRefDisabled = await Test.createTestingModule({
      providers: [
        SmtpValidatorService,
        SmtpResponseParser,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({ enabled: false }),
          },
        },
      ],
    }).compile();

    const disabledService = moduleRefDisabled.get(SmtpValidatorService);
    const result = await disabledService.validate('user@test.com', 'mx.test', {
      provider: 'unknown',
      riskProfile: 'unknown',
    });
    expect(result.status).toBe('skipped');
    expect(net.createConnection).not.toHaveBeenCalled();
  });

  it('simulates a successful SMTP transaction', async () => {
    const promise = service.validate('user@test.com', 'mx.test', {
      provider: 'unknown',
      riskProfile: 'unknown',
    });

    // Simulate connect
    const onConnect = mockSocket.once.mock.calls.find(
      (call: any) => call[0] === 'connect',
    )[1];
    onConnect();

    // The service registers 'data' handler
    const onData = mockSocket.on.mock.calls.find(
      (call: any) => call[0] === 'data',
    )[1];

    // Banner
    onData(Buffer.from('220 mx.test ESMTP\r\n'));
    expect(mockSocket.write).toHaveBeenCalledWith('EHLO test.com\r\n');

    // EHLO response
    onData(Buffer.from('250-mx.test\r\n250 ENHANCEDSTATUSCODES\r\n'));
    expect(mockSocket.write).toHaveBeenCalledWith(
      'MAIL FROM:<probe@test.com>\r\n',
    );

    // MAIL FROM response
    onData(Buffer.from('250 2.1.0 OK\r\n'));
    expect(mockSocket.write).toHaveBeenCalledWith(
      'RCPT TO:<user@test.com>\r\n',
    );

    // RCPT TO response
    onData(Buffer.from('250 2.1.5 OK\r\n'));
    expect(mockSocket.write).toHaveBeenCalledWith('QUIT\r\n');

    // We can simulate socket closing or just trigger finish by responding to quit
    onData(Buffer.from('221 2.0.0 Bye\r\n'));

    const result = await promise;
    expect(result.status).toBe('accepted');
    expect(result.code).toBe(250);
  });

  it('handles connection timeout', async () => {
    const promise = service.validate('user@test.com', 'mx.test', {
      provider: 'unknown',
      riskProfile: 'unknown',
    });

    const onTimeout = mockSocket.on.mock.calls.find(
      (call: any) => call[0] === 'timeout',
    )[1];
    onTimeout();

    const result = await promise;
    expect(result.status).toBe('timeout');
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  it('handles connection error', async () => {
    const promise = service.validate('user@test.com', 'mx.test', {
      provider: 'unknown',
      riskProfile: 'unknown',
    });

    const onError = mockSocket.on.mock.calls.find(
      (call: any) => call[0] === 'error',
    )[1];
    onError(new Error('ECONNREFUSED'));

    const result = await promise;
    expect(result.status).toBe('connection_failed');
  });
});

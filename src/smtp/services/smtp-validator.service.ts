import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import { SmtpConfig } from '../../config/smtp.config';
import { SmtpSignal } from '../../common/types/validation.types';
import { SmtpResponseParser } from './smtp-response-parser';
import { ProviderDetectionResult } from './provider-detection.service';

@Injectable()
export class SmtpValidatorService {
  private readonly logger = new Logger(SmtpValidatorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly parser: SmtpResponseParser,
  ) {}

  async validate(
    email: string,
    mxHost: string,
    providerDetection: ProviderDetectionResult,
  ): Promise<SmtpSignal> {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config || !config.enabled) {
      return this.parser.parse(
        'skipped',
        null,
        providerDetection.provider,
        providerDetection.riskProfile,
        mxHost,
        0,
      );
    }

    const startTime = Date.now();

    return new Promise((resolve) => {
      const socket = net.createConnection({
        host: mxHost,
        port: 25,
      });

      let responseBuffer = '';
      let stage = 'CONNECT';
      let done = false;

      const finish = (rawMessage: string | null, status: any) => {
        if (done) return;
        done = true;
        socket.destroy();
        const durationMs = Date.now() - startTime;
        resolve(
          this.parser.parse(
            status,
            rawMessage,
            providerDetection.provider,
            providerDetection.riskProfile,
            mxHost,
            durationMs,
          ),
        );
      };

      // Set connection timeout
      socket.setTimeout(config.connectTimeoutMs);

      socket.once('connect', () => {
        // Change timeout to read timeout for subsequent operations
        socket.setTimeout(config.readTimeoutMs);
        stage = 'WAIT_BANNER';
      });

      socket.on('timeout', () => {
        finish(responseBuffer || 'Connection timed out', 'timeout');
      });

      socket.on('error', (err: any) => {
        this.logger.debug(
          `SMTP Error for ${email} on ${mxHost}: ${err.message}`,
        );
        finish(err.message, 'connection_failed');
      });

      socket.on('data', (data) => {
        const text = data.toString('utf-8');
        responseBuffer += text;

        // SMTP responses end with \r\n, and multi-line responses have a dash after the code
        // We need to wait for a line with a space after the code to know the response is complete
        const lines = responseBuffer.split('\r\n').filter(Boolean);
        const lastLine = lines[lines.length - 1];

        if (!lastLine || (lastLine.length >= 4 && lastLine[3] === '-')) {
          // Incomplete response, wait for more data
          return;
        }

        const currentResponse = responseBuffer;
        responseBuffer = ''; // Reset buffer for next command

        const codeMatch = currentResponse.match(/^(\d{3})/);
        const code = codeMatch ? parseInt(codeMatch[1], 10) : 0;

        if (stage === 'WAIT_BANNER') {
          if (code >= 200 && code < 300) {
            stage = 'EHLO';
            socket.write(`EHLO ${config.ehloName}\r\n`);
          } else {
            finish(currentResponse, 'unknown');
          }
        } else if (stage === 'EHLO') {
          if (code >= 200 && code < 300) {
            stage = 'MAIL_FROM';
            socket.write(`MAIL FROM:<${config.mailFrom}>\r\n`);
          } else {
            finish(currentResponse, 'unknown');
          }
        } else if (stage === 'MAIL_FROM') {
          if (code >= 200 && code < 300) {
            stage = 'RCPT_TO';
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            finish(currentResponse, 'unknown'); // E.g., our probe email was rejected
          }
        } else if (stage === 'RCPT_TO') {
          // This is the response we care about
          socket.write('QUIT\r\n');
          stage = 'QUIT';
          // We don't finish yet, let it gracefully close, but we have our result.
          finish(currentResponse, 'unknown'); // Parser will determine the actual status based on code
        } else if (stage === 'QUIT') {
          // Connection closing
        }
      });
    });
  }
}

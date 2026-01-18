import crypto from 'crypto';
import { logger, AuditLogger } from './secure-logger';
import { AdvancedRateLimiter } from './rate-limiter-advanced';

export class SecurityAudit {
  private static instance: SecurityAudit;
  private auditLogger = AuditLogger.getInstance();

  private suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+="[^"]*"/gi,
    /union.*select/gi,
    /or.*1=1/gi,
    /drop.*table/gi,
    /exec\(/gi,
    /eval\(/gi,
    /document\.cookie/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /process\.env/gi,
    /require\(/gi,
    /import\(/gi,
    /fs\./gi,
    /child_process/gi,
    /\.\.\//g, // Directory traversal
  ];

  static getInstance(): SecurityAudit {
    if (!SecurityAudit.instance) {
      SecurityAudit.instance = new SecurityAudit();
    }
    return SecurityAudit.instance;
  }

  scanInput(input: any, context: string = 'unknown'): {
    isMalicious: boolean;
    threats: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const threats: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    const scanRecursive = (value: any, path: string = '') => {
      if (typeof value === 'string') {
        this.suspiciousPatterns.forEach((pattern, index) => {
          if (pattern.test(value)) {
            const threatName = this.getThreatName(index);
            threats.push(`${path}: ${threatName}`);

            // Update risk level
            if (threatName.includes('SQL') || threatName.includes('XSS')) {
              riskLevel = 'CRITICAL';
            } else if (riskLevel !== 'CRITICAL' && threatName.includes('injection')) {
              riskLevel = 'HIGH';
            }
          }
        });

        // Check for extremely long strings (potential DoS)
        if (value.length > 100000) {
          threats.push(`${path}: Potential DoS - extremely long string`);
          riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
        }

        // Check for binary data in strings
        const binaryMatch = value.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
        if (binaryMatch) {
          threats.push(`${path}: Binary data in string`);
          riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => scanRecursive(item, `${path}[${i}]`));
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => {
          scanRecursive(val, path ? `${path}.${key}` : key);
        });
      }
    };

    scanRecursive(input);

    if (threats.length > 0) {
      this.auditLogger.logSecurityEvent('MALICIOUS_INPUT_DETECTED', {
        context,
        threats,
        riskLevel,
        inputSample: this.safeStringify(input, 1000)
      });
    }

    return {
      isMalicious: threats.length > 0,
      threats,
      riskLevel
    };
  }

  private getThreatName(index: number): string {
    const names = [
      'XSS - Script tag',
      'XSS - JavaScript protocol',
      'XSS - Event handler',
      'SQL Injection - UNION SELECT',
      'SQL Injection - OR 1=1',
      'SQL Injection - DROP TABLE',
      'Code Injection - exec',
      'Code Injection - eval',
      'Cookie theft',
      'Local storage access',
      'Session storage access',
      'Environment variable access',
      'Dynamic require',
      'Dynamic import',
      'File system access',
      'Child process execution',
      'Directory traversal'
    ];
    return names[index] || `Unknown threat pattern ${index}`;
  }

  private safeStringify(obj: any, maxLength: number): string {
    try {
      const str = JSON.stringify(obj);
      return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    } catch {
      return '[Unserializable object]';
    }
  }

  generateSecurityHeaders(): Record<string, string> {
    const nonce = crypto.randomBytes(16).toString('base64');

    return {
      'Content-Security-Policy': [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: https:`,
        `font-src 'self'`,
        `connect-src 'self'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`
      ].join('; '),

      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()'
      ].join(', '),

      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-store, max-age=0'
    };
  }

  async rateLimitByComplexity(
    operation: () => Promise<any>,
    complexityScore: number,
    userId?: string
  ): Promise<any> {
    const baseLimit = 100;
    const adjustedLimit = Math.max(1, Math.floor(baseLimit / complexityScore));

    // Use rate limiter with complexity-adjusted limits
    const rateLimiter = new AdvancedRateLimiter();
    const result = await rateLimiter.checkRateLimit(
      userId || 'anonymous',
      { limit: adjustedLimit, window: 3600 }
    );

    if (!result.allowed) {
      throw new Error(`Complexity-based rate limit exceeded. Try simpler operations.`);
    }

    return operation();
  }
}

export const securityAudit = SecurityAudit.getInstance();

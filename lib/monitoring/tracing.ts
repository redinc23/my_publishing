import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('authorsphere');

export async function traced<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function getTraceId(): string {
  return trace.getActiveSpan()?.spanContext().traceId || 'no-trace';
}

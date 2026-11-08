import { errorDetails, log } from './log';

/**
 * Records errors nothing else caught: exceptions thrown from event handlers and timers, and
 * rejected promises nobody awaited. React reports render errors outside an error boundary
 * the same way. Returns a function that stops listening.
 */
export function logUncaughtErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent) =>
    log.error('uncaught.error', {
      ...errorDetails(event.error ?? event.message),
      source: event.filename || undefined,
      line: event.lineno || undefined,
    });
  const onRejection = (event: PromiseRejectionEvent) =>
    log.error('uncaught.rejection', errorDetails(event.reason));
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}

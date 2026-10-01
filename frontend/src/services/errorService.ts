// Centralized error reporting and normalization service
// @ts-expect-error report.js is a plain JavaScript starter stub
import { report } from '../../report.js';
import { ErrorRegion, ReportContext } from '../types/error';

// Tracks active failure lifecycles to ensure exactly-once reporting per failure
const activeFailures = new Set<string>();

export function isCancelledError(error: any): boolean {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  if (error.message && error.message.includes('aborted')) return true;
  if (error.__cancelled === true) return true;
  return false;
}

export function buildFailureKey(
  region: ErrorRegion,
  screenId: string | null,
  elementKey?: string,
  failureToken?: string
): string {
  const parts = [
    region,
    screenId ?? 'board',
    elementKey ?? '',
    failureToken ?? '',
  ];
  return parts.join('::');
}

export function reportRegionFailure(
  error: any,
  context: ReportContext,
  failureToken?: string
): boolean {
  // Never report cancelled or aborted requests
  if (isCancelledError(error)) {
    return false;
  }

  const failureKey = buildFailureKey(
    context.region,
    context.screenId,
    context.elementKey,
    failureToken
  );

  // If already reported for this active failure cycle, do not report again
  if (activeFailures.has(failureKey)) {
    return false;
  }

  activeFailures.add(failureKey);

  try {
    report(error, {
      region: context.region,
      screenId: context.screenId,
      ...(context.elementKey ? { elementKey: context.elementKey } : {}),
    });
    return true;
  } catch (err) {
    console.error('[ErrorService] Failed to invoke report()', err);
    return false;
  }
}

export function clearRegionFailure(
  region: ErrorRegion,
  screenId: string | null,
  elementKey?: string,
  failureToken?: string
): void {
  // If specific failureToken provided, remove that specific key
  if (failureToken) {
    activeFailures.delete(buildFailureKey(region, screenId, elementKey, failureToken));
    return;
  }

  // Otherwise remove all matching keys for this region/screen/element
  const prefix = `${region}::${screenId ?? 'board'}::${elementKey ?? ''}`;
  for (const key of Array.from(activeFailures)) {
    if (key.startsWith(prefix)) {
      activeFailures.delete(key);
    }
  }
}

export function resetAllFailures(): void {
  activeFailures.clear();
}

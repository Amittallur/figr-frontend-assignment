import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-expect-error report.js is a plain JavaScript starter stub
import * as reporterStub from '../../report.js';
import {
  reportRegionFailure,
  clearRegionFailure,
  resetAllFailures,
  isCancelledError,
} from '../services/errorService';

describe('Error Reporting & Normalization (R6.4)', () => {
  let reportSpy: any;

  beforeEach(() => {
    resetAllFailures();
    vi.restoreAllMocks();
    reportSpy = vi.spyOn(reporterStub, 'report');
  });

  it('reports a region failure exactly once', () => {
    const error = new Error('Connection timeout');
    const reported = reportRegionFailure(
      error,
      { region: 'preview', screenId: 'scr-01' },
      'timeout_1'
    );

    expect(reported).toBe(true);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(error, {
      region: 'preview',
      screenId: 'scr-01',
    });

    // Calling again with same context and token must be suppressed
    const reportedAgain = reportRegionFailure(
      error,
      { region: 'preview', screenId: 'scr-01' },
      'timeout_1'
    );
    expect(reportedAgain).toBe(false);
    expect(reportSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT report cancelled or aborted requests', () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';

    const reported = reportRegionFailure(abortErr, {
      region: 'details',
      screenId: 'scr-01',
      elementKey: 'cta-primary',
    });

    expect(reported).toBe(false);
    expect(reportSpy).not.toHaveBeenCalled();
    expect(isCancelledError(abortErr)).toBe(true);
  });

  it('counts a retry that fails again as a NEW failure and reports it', () => {
    const error1 = new Error('500 Server Error');
    reportRegionFailure(
      error1,
      { region: 'details', screenId: 'scr-01', elementKey: 'cta-primary' },
      'det_1'
    );
    expect(reportSpy).toHaveBeenCalledTimes(1);

    // User clicks Retry: clears previous failure record
    clearRegionFailure('details', 'scr-01', 'cta-primary', 'det_1');

    // Retry fails again
    const error2 = new Error('500 Server Error on Retry');
    const reportedRetry = reportRegionFailure(
      error2,
      { region: 'details', screenId: 'scr-01', elementKey: 'cta-primary' },
      'det_1'
    );

    expect(reportedRetry).toBe(true);
    expect(reportSpy).toHaveBeenCalledTimes(2);
  });
});

declare module '../../report.js' {
  export function report(
    error: any,
    context: {
      region: string;
      screenId: string | null;
      elementKey?: string;
    }
  ): void;
}

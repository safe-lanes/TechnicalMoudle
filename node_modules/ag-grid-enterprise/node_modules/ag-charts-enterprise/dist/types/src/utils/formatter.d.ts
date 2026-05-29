import type { Formatter } from 'ag-charts-community';
interface Ctx {
    chartService: {
        context?: unknown;
    };
}
export declare function formatWithContext<P>(ctx: Ctx, formatter: Formatter<P>, params: P): string | undefined;
export {};

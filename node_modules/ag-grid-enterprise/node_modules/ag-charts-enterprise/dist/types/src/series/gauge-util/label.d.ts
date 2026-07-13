import type { AgChartLabelFormatterParams, Formatter, _ModuleSupport } from 'ag-charts-community';
interface GaugeLabelDatum {
    value: number;
    text?: string;
    formatter?: Formatter<AgChartLabelFormatterParams<any>>;
}
interface Ctx {
    chartService: {
        context?: unknown;
    };
}
export declare const fadeInFns: _ModuleSupport.FromToFns<_ModuleSupport.Node, any, any>;
export declare function formatLabel(value: number | undefined, scale: {
    min: number;
    max: number;
}): string;
export declare function getLabelText(seriesId: string, ctx: Ctx, datum: GaugeLabelDatum, valueOverride?: number): string | undefined;
export {};

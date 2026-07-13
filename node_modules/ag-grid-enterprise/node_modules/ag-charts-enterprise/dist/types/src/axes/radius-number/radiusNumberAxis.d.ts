import { type FormatterParams, _ModuleSupport } from 'ag-charts-community';
import { RadiusAxis } from '../radius/radiusAxis';
interface TickDatum {
    tickLabel: string | undefined;
    tick: any;
    tickId: string;
    translation: number;
}
export declare class RadiusNumberAxis extends RadiusAxis {
    static readonly className = "RadiusNumberAxis";
    static readonly type: "radius-number";
    shape: 'polygon' | 'circle';
    min?: number;
    max?: number;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    hasDefinedDomain(): boolean;
    protected prepareGridPathTickData(data: _ModuleSupport.TickDatum[]): _ModuleSupport.TickDatum[];
    protected getTickRadius(tickDatum: TickDatum): number;
    normaliseDataDomain(d: number[]): {
        domain: number[];
        clipped: boolean;
    };
    tickFormatParams(_domain: number[], _ticks: number[], fractionDigits?: number): _ModuleSupport.AxisTickFormatParams;
    datumFormatParams(value: any, params: _ModuleSupport.FormatDatumParams, fractionDigits?: number): FormatterParams<any>;
}
export {};

import { type FormatterParams, _ModuleSupport } from 'ag-charts-community';
import { RadiusAxis } from '../radius/radiusAxis';
export declare class RadiusCategoryAxis extends RadiusAxis {
    static readonly className = "RadiusCategoryAxis";
    static readonly type: "radius-category";
    shape: "circle";
    groupPaddingInner: number;
    paddingInner: number;
    paddingOuter: number;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    hasDefinedDomain(): boolean;
    normaliseDataDomain(domain: Array<string | object>): {
        domain: (string | object)[];
        clipped: boolean;
    };
    protected prepareGridPathTickData(data: _ModuleSupport.TickDatum[]): _ModuleSupport.TickDatum[];
    protected getTickRadius(tickDatum: _ModuleSupport.TickDatum): number;
    tickFormatParams(): _ModuleSupport.AxisTickFormatParams;
    datumFormatParams(value: any, params: _ModuleSupport.FormatDatumParams): FormatterParams<any>;
}

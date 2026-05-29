import { type AgTimeInterval, type AgTimeIntervalUnit, type DateFormatterStyle, type FormatterParams, _ModuleSupport } from 'ag-charts-community';
export declare class OrdinalTimeAxis extends _ModuleSupport.DiscreteTimeAxis<_ModuleSupport.OrdinalTimeScale> {
    static readonly className: "OrdinalTimeAxis";
    static readonly type: "ordinal-time";
    readonly parentLevel: _ModuleSupport.TimeAxisParentLevel;
    minimumTimeGranularity: AgTimeIntervalUnit | undefined;
    get primaryLabel(): _ModuleSupport.AxisLabel | undefined;
    get primaryTick(): _ModuleSupport.AxisTick | undefined;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    processData(): void;
    tickFormatParams(domain: (number | Date)[], ticks: (number | Date)[], _fractionDigits?: number, timeInterval?: AgTimeInterval | AgTimeIntervalUnit): _ModuleSupport.AxisTickFormatParams;
    datumFormatParams(value: Date | number, params: _ModuleSupport.FormatDatumParams, _fractionDigits: number | undefined, timeInterval: AgTimeInterval | AgTimeIntervalUnit | undefined, style: DateFormatterStyle): FormatterParams<any>;
}

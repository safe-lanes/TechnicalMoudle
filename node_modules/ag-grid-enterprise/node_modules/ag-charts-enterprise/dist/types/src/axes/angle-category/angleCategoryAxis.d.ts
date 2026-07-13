import { type FormatterParams, _ModuleSupport } from 'ag-charts-community';
import { AngleAxisInterval } from '../angle-number/angleAxisInterval';
import type { AngleAxisLabelDatum } from '../angle/angleAxis';
import { AngleAxis } from '../angle/angleAxis';
export declare class AngleCategoryAxis extends AngleAxis<string, _ModuleSupport.BandScale<string>> {
    static readonly className = "AngleCategoryAxis";
    static readonly type: "angle-category";
    groupPaddingInner: number;
    paddingInner: number;
    interval: AngleAxisInterval;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    hasDefinedDomain(): boolean;
    protected generateAngleTicks(domain: string[]): {
        value: any;
        visible: boolean;
    }[];
    protected avoidLabelCollisions(labelData: AngleAxisLabelDatum[]): void;
    tickFormatParams(): _ModuleSupport.AxisTickFormatParams;
    datumFormatParams(value: any, params: _ModuleSupport.FormatDatumParams): FormatterParams<any>;
}

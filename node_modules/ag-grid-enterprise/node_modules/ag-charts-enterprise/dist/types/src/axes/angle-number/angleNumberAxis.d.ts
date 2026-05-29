import { type FormatterParams, _ModuleSupport } from 'ag-charts-community';
import type { AngleAxisLabelDatum } from '../angle/angleAxis';
import { AngleAxis } from '../angle/angleAxis';
import { AngleAxisInterval } from './angleAxisInterval';
import { LinearAngleScale } from './linearAngleScale';
export declare class AngleNumberAxis extends AngleAxis<number, LinearAngleScale> {
    static readonly className = "AngleNumberAxis";
    static readonly type: "angle-number";
    shape: "circle";
    min?: number;
    max?: number;
    interval: AngleAxisInterval;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    hasDefinedDomain(): boolean;
    normaliseDataDomain(d: number[]): {
        domain: number[];
        clipped: boolean;
    };
    updateScale(): void;
    protected getRangeArcLength(): number;
    protected generateAngleTicks(domain: number[]): {
        value: number;
        visible: boolean;
    }[];
    protected avoidLabelCollisions(labelData: AngleAxisLabelDatum[]): void;
    tickFormatParams(_domain: number[], _ticks: number[], fractionDigits?: number): _ModuleSupport.AxisTickFormatParams;
    datumFormatParams(value: any, params: _ModuleSupport.FormatDatumParams, fractionDigits?: number): FormatterParams<any>;
}

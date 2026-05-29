import { type TextAlign, type VerticalAlign, _ModuleSupport } from 'ag-charts-community';
import type { RadialGaugeNeedle } from './radialGaugeNeedle';
import { type RadialGaugeLabelDatum } from './radialGaugeSeriesProperties';
interface AnimatableSectorDatum {
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    clipStartAngle: number | undefined;
    clipEndAngle: number | undefined;
}
type SectorAnimation = {
    startAngle: number;
    endAngle: number;
    clipSector: _ModuleSupport.SectorBox | undefined;
};
type AnimatableNeedleDatum = {
    radius: number;
    angle: number;
};
interface Ctx {
    chartService: {
        context?: unknown;
    };
}
export declare function prepareRadialGaugeSeriesAnimationFunctions(initialLoad: boolean, initialStartAngle: number): {
    node: _ModuleSupport.FromToFns<_ModuleSupport.Sector<any>, SectorAnimation, AnimatableSectorDatum>;
    needle: _ModuleSupport.FromToFns<RadialGaugeNeedle, any, AnimatableNeedleDatum>;
};
export declare function resetRadialGaugeSeriesResetSectorFunction(_node: _ModuleSupport.Sector, datum: AnimatableSectorDatum): {
    startAngle: number;
    endAngle: number;
    clipSector: _ModuleSupport.SectorBox | undefined;
    visible: boolean;
};
export declare function resetRadialGaugeSeriesResetNeedleFunction(_node: RadialGaugeNeedle, datum: AnimatableNeedleDatum): {
    rotation: number;
};
export declare function formatRadialGaugeLabels(series: _ModuleSupport.Series<unknown, any, object, any>, ctx: Ctx, selection: _ModuleSupport.Selection<_ModuleSupport.Text, RadialGaugeLabelDatum>, opts: {
    padding: number;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
}, innerRadius: number, datumOverrides?: {
    label: number | undefined;
    secondaryLabel: number | undefined;
}): void;
export {};

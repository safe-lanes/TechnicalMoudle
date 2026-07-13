import { _ModuleSupport } from 'ag-charts-community';
import type { LinearGaugeLabelDatum } from './linearGaugeSeriesProperties';
interface AnimatableRectDatum {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    clipX0: number | undefined;
    clipY0: number | undefined;
    clipX1: number | undefined;
    clipY1: number | undefined;
    horizontalInset: number;
    verticalInset: number;
}
type RectAnimationParams = {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    clipX0: number | undefined;
    clipY0: number | undefined;
    clipX1: number | undefined;
    clipY1: number | undefined;
    horizontalInset: number;
    verticalInset: number;
};
interface Ctx {
    chartService: {
        context?: unknown;
    };
}
export declare function prepareLinearGaugeSeriesAnimationFunctions(initialLoad: boolean, horizontal: boolean): {
    node: _ModuleSupport.FromToFns<_ModuleSupport.Rect<any>, RectAnimationParams, AnimatableRectDatum>;
};
export declare function resetLinearGaugeSeriesResetRectFunction(_node: _ModuleSupport.Rect, datum: AnimatableRectDatum): {
    x: number;
    y: number;
    width: number;
    height: number;
    clipBBox: _ModuleSupport.BBox | undefined;
    visible: boolean;
};
export declare function formatLinearGaugeLabels(series: _ModuleSupport.Series<unknown, any, object, any>, ctx: Ctx, selection: _ModuleSupport.Selection<_ModuleSupport.Text, LinearGaugeLabelDatum>, opts: {
    padding: number;
    horizontal: boolean;
}, bboxes: {
    seriesRect: _ModuleSupport.BBox;
    gaugeRect: _ModuleSupport.BBox;
    barRect: _ModuleSupport.BBox;
}, datumOverrides?: {
    label: number | undefined;
}): void;
export {};

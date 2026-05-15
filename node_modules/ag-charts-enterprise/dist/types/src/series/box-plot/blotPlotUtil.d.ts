import type { BoxPlotNode } from './boxPlotNode';
import type { BoxPlotNodeDatum } from './boxPlotTypes';
export declare function prepareBoxPlotFromTo(isVertical: boolean): {
    from: {
        scalingX: number;
        scalingY: number;
    };
    to: {
        scalingX: number;
        scalingY: number;
    };
};
export declare function resetBoxPlotSelectionsScalingCenterFn(isVertical: boolean): (node: BoxPlotNode, datum: BoxPlotNodeDatum) => {
    scalingCenterY: number;
} | {
    scalingCenterX: number;
};

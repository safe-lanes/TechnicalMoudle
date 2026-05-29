import type { Direction, _ModuleSupport } from 'ag-charts-community';
import type { FunnelConnector } from '../funnel/funnelConnector';
type AnimatablePyramidDatum = {
    x: number;
    y: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
};
export declare function applyPyramidDatum(connector: FunnelConnector, { x, y, top, right, bottom, left }: AnimatablePyramidDatum): void;
export declare function preparePyramidAnimationFunctions<T extends AnimatablePyramidDatum>(direction: Direction): {
    fromFn: _ModuleSupport.FromToMotionPropFn<FunnelConnector<any>, AnimatablePyramidDatum, T>;
    toFn: _ModuleSupport.FromToMotionPropFn<FunnelConnector<any>, AnimatablePyramidDatum, T>;
    applyFn: _ModuleSupport.ApplyFn<FunnelConnector<any>, AnimatablePyramidDatum>;
};
export {};

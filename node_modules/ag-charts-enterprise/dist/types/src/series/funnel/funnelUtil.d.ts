import { _ModuleSupport } from 'ag-charts-community';
import type { FunnelConnector } from './funnelConnector';
type AnimatableConnectorDatum = {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;
    opacity: number | undefined;
};
export declare function prepareConnectorAnimationFunctions<T extends AnimatableConnectorDatum>(isVertical: boolean, mode: 'normal' | 'fade'): {
    fromFn: _ModuleSupport.FromToMotionPropFn<FunnelConnector<any>, AnimatableConnectorDatum, T>;
    toFn: _ModuleSupport.FromToMotionPropFn<FunnelConnector<any>, AnimatableConnectorDatum, T>;
};
export declare function resetConnectorSelectionsFn(_node: FunnelConnector, datum: AnimatableConnectorDatum): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;
    opacity: number | undefined;
};
export {};

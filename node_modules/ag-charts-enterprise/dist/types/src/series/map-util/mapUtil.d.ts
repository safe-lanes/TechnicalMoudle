import type { _ModuleSupport } from 'ag-charts-community';
import type { GeoGeometry } from './geoGeometry';
type AnimatableMapMarkerDatum = {
    scalingX: number;
    scalingY: number;
};
export declare function prepareMapMarkerAnimationFunctions(): {
    fromFn: _ModuleSupport.FromToMotionPropFn<_ModuleSupport.Marker, AnimatableMapMarkerDatum, unknown>;
    toFn: _ModuleSupport.FromToMotionPropFn<_ModuleSupport.Marker, AnimatableMapMarkerDatum, unknown>;
};
type SomeMapSeries<TDatum> = {
    contextNodeData?: {
        nodeData: TDatum[];
    };
    datumSelection: _ModuleSupport.Selection<GeoGeometry, TDatum>;
};
export declare function findFocusedGeoGeometry<TDatum>(series: SomeMapSeries<TDatum>, opts: _ModuleSupport.PickFocusInputs): GeoGeometry | undefined;
export {};

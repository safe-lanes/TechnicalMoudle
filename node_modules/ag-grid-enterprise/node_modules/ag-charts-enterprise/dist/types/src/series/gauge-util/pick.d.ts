import type { _ModuleSupport } from 'ag-charts-community';
type SceneNode = _ModuleSupport.Node;
type Point = _ModuleSupport.Point;
type SeriesNodeDatum = _ModuleSupport.SeriesNodeDatum<unknown>;
type SeriesNodePickMatch = _ModuleSupport.SeriesNodePickMatch;
type SelectionNode = {
    node: _ModuleSupport.Path;
    datum: SeriesNodeDatum;
};
type SelectionLike = Iterable<SelectionNode> & {
    nodes(): Iterable<SceneNode>;
};
type PickFocusInputs = _ModuleSupport.PickFocusInputs;
type PickFocusOutputs = _ModuleSupport.PickFocusOutputs;
type GaugeSeries = {
    contextNodeData?: {
        nodeData: SeriesNodeDatum[];
        targetData: SeriesNodeDatum[];
    };
    datumUnion: SelectionLike;
    targetSelection: SelectionLike;
    pickNodeNearestDistantObject(point: Point, items: Iterable<SceneNode>): SeriesNodePickMatch | undefined;
};
export declare function pickGaugeNearestDatum(self: GaugeSeries, point: Point): SeriesNodePickMatch | undefined;
export declare function pickGaugeFocus(self: GaugeSeries, opts: PickFocusInputs): PickFocusOutputs | undefined;
export {};

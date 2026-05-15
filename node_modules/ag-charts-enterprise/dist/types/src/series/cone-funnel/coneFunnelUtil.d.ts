import type { _ModuleSupport } from 'ag-charts-community';
type AnimatableBarDatum = {
    x: number;
    y: number;
    height: number;
    width: number;
    opacity?: number;
};
export declare function resetLineSelectionsFn(_node: _ModuleSupport.Line, { x, y, width, height, opacity }: AnimatableBarDatum): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    opacity: number;
};
export {};

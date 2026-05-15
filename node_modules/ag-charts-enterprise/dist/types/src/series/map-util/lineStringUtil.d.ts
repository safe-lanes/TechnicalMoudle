import type { _ModuleSupport } from 'ag-charts-community';
export declare function lineSegmentDistanceToPointSquared(a: _ModuleSupport.Position, b: _ModuleSupport.Position, x: number, y: number): number;
export declare function lineStringDistance(lineString: _ModuleSupport.Position[], x: number, y: number): number;
export declare function lineStringLength(lineSegment: _ModuleSupport.Position[]): number;
export declare function lineStringCenter(lineSegment: _ModuleSupport.Position[]): {
    point: _ModuleSupport.Position;
    angle: number;
} | undefined;

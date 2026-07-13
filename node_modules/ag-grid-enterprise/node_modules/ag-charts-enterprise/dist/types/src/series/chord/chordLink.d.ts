import { _ModuleSupport } from 'ag-charts-community';
declare const Path: typeof _ModuleSupport.Path;
export declare function bezierControlPoints({ radius, startAngle, endAngle, tension, }: {
    radius: number;
    startAngle: number;
    endAngle: number;
    tension: number;
}): {
    x: readonly [number, number, number, number];
    y: readonly [number, number, number, number];
};
export declare class ChordLink<D = any> extends Path<D> {
    centerX: number;
    centerY: number;
    radius: number;
    startAngle1: number;
    endAngle1: number;
    startAngle2: number;
    endAngle2: number;
    tension: number;
    private tensionedCurveTo;
    updatePath(): void;
}
export {};

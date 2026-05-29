import { _ModuleSupport } from 'ag-charts-community';
import type { StrokeOptions } from 'ag-charts-types';
export declare abstract class CapScene extends _ModuleSupport.Group {
    abstract type: string;
    abstract update(options: {
        x: number;
        y: number;
        angle: number;
    } & StrokeOptions): void;
}
export declare class ArrowCapScene extends CapScene {
    type: "arrow";
    private readonly path;
    private readonly armLength;
    constructor();
    update(options: {
        x: number;
        y: number;
        angle: number;
    } & StrokeOptions): void;
}

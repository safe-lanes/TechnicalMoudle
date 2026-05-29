import { _ModuleSupport } from 'ag-charts-community';
declare const LinearScale: typeof _ModuleSupport.LinearScale;
export declare class LinearAngleScale extends LinearScale {
    static getNiceStepAndTickCount(ticks: _ModuleSupport.ScaleTickParams<number>, domain: number[]): {
        count: number;
        step: number;
    };
    arcLength: number;
    ticks(ticks: _ModuleSupport.ScaleTickParams<number>, domain?: number[]): {
        ticks: number[];
        count: number;
    };
    private hasNiceRange;
    niceDomain(ticks: _ModuleSupport.ScaleTickParams<number>, domain?: number[]): number[];
    protected getPixelRange(): number;
}
export {};

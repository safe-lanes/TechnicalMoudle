import { type ColorSpace } from 'ag-charts-core';
import type { BBox } from '../bbox';
import { Gradient } from './gradient';
import type { GradientColorStop } from './stops';
export declare class LinearGradient extends Gradient {
    angle: number;
    constructor(colorSpace: ColorSpace, stops: GradientColorStop[], angle?: number, bbox?: BBox);
    private getGradientPoints;
    protected createCanvasGradient(ctx: CanvasRenderingContext2D, bbox: BBox): CanvasGradient | undefined;
    createSvgGradient(bbox: BBox): SVGLinearGradientElement;
}

import { Rect } from './rect';
export declare class BarShape<D = any> extends Rect<D> {
    direction: 'x' | 'y';
    featherRatio: number;
    private get feathered();
    isPointInPath(x: number, y: number): boolean;
    updatePath(): void;
    renderStroke(ctx: CanvasRenderingContext2D & {
        setLineDash(lineDash: readonly number[]): void;
    }): void;
}

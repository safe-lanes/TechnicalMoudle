import type { DistantObject } from '../../util/nearest';
import type { BBox } from '../bbox';
import { ExtendedPath2D } from '../extendedPath2D';
import type { ChildNodeCounts, RenderContext } from '../node';
import { Shape } from './shape';
export declare class Path<D = any> extends Shape<D> implements DistantObject {
    static readonly className: string;
    /**
     * Declare a path to retain for later rendering and hit testing
     * using custom Path2D class. Think of it as a TypeScript version
     * of the native Path2D (with some differences) that works in all browsers.
     */
    path: ExtendedPath2D;
    protected _clipX: number;
    protected _clipY: number;
    protected _clipPath?: ExtendedPath2D;
    clip: boolean;
    set clipX(value: number);
    set clipY(value: number);
    /**
     * The path only has to be updated when certain attributes change.
     * For example, if transform attributes (such as `translationX`)
     * are changed, we don't have to update the path. The `dirtyPath` flag
     * is how we keep track if the path has to be updated or not.
     */
    private _dirtyPath;
    set dirtyPath(value: boolean);
    get dirtyPath(): boolean;
    checkPathDirty(): void;
    resetPathDirty(): void;
    isPathDirty(): boolean;
    onChangeDetection(property: string): void;
    protected computeBBox(): BBox | undefined;
    isPointInPath(x: number, y: number): boolean;
    distanceSquared(x: number, y: number): number;
    svgPathData(transform?: (x: number, y: number) => {
        x: number;
        y: number;
    }): string;
    protected distanceSquaredTransformedPoint(x: number, y: number): number;
    protected isDirtyPath(): boolean;
    updatePath(): void;
    protected updatePathIfDirty(): void;
    private lastPixelRatio;
    preRender(renderCtx: RenderContext): ChildNodeCounts;
    render(renderCtx: RenderContext): void;
    drawPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void;
    toSVG(): {
        elements: SVGElement[];
        defs?: SVGElement[];
    } | undefined;
}

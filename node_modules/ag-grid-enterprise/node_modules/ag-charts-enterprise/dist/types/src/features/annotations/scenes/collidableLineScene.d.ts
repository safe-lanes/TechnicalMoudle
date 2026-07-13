import { _ModuleSupport } from 'ag-charts-community';
type ShapeClipMask = {
    x: number;
    y: number;
    radius: number;
};
export declare class CollidableLine extends _ModuleSupport.Line {
    collisionBBox?: _ModuleSupport.BBox;
    private readonly growCollisionBox;
    protected clipMask: Map<string, ShapeClipMask>;
    setProperties<T>(styles: {
        [K in keyof T]?: T[K] | undefined;
    }): T;
    private updateCollisionBBox;
    isPointInPath(pointX: number, pointY: number): boolean;
    render(renderCtx: _ModuleSupport.RenderContext): void;
    setClipMask(id: string, mask?: ShapeClipMask): void;
}
export {};

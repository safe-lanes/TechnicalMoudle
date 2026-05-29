import { _ModuleSupport } from 'ag-charts-community';
declare const Path: typeof _ModuleSupport.Path;
export declare enum GeoGeometryRenderMode {
    All = 3,
    Polygons = 1,
    Lines = 2
}
export declare class GeoGeometry<D = any> extends Path<D> implements _ModuleSupport.DistantObject {
    projectedGeometry: _ModuleSupport.Geometry | undefined;
    renderMode: GeoGeometryRenderMode;
    private bbox;
    private readonly strokePath;
    protected computeBBox(): _ModuleSupport.BBox | undefined;
    updatePath(): void;
    drawPath(ctx: any): void;
    containsPoint(x: number, y: number): boolean;
    distanceSquared(x: number, y: number): number;
    private geometryDistance;
    private drawGeometry;
    private drawPolygon;
    private drawLineString;
}
export {};

import { type AgAnnotationLineStyleType, type PixelSize, _ModuleSupport } from 'ag-charts-community';
export declare function getLineStyle(lineDash?: PixelSize[], lineStyle?: AgAnnotationLineStyleType): AgAnnotationLineStyleType;
export declare function getComputedLineDash(strokeWidth: number, styleType: AgAnnotationLineStyleType): PixelSize[];
export declare function getLineDash(lineDash?: PixelSize[], computedLineDash?: PixelSize[], lineStyle?: AgAnnotationLineStyleType, strokeWidth?: number): PixelSize[] | undefined;
export declare function getLineCap(lineCap?: _ModuleSupport.ShapeLineCap, lineDash?: PixelSize[], lineStyle?: AgAnnotationLineStyleType): _ModuleSupport.ShapeLineCap | undefined;
/**
 * Find the pair of points where a line intersects a bounding box.
 */
export declare function boundsIntersections(coords: _ModuleSupport.Vec4, bounds: _ModuleSupport.BBox): [_ModuleSupport.Vec2, _ModuleSupport.Vec2];

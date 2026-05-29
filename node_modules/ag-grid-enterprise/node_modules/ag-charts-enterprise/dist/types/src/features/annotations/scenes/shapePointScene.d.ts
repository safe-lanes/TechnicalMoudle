import type { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext } from '../annotationTypes';
import type { ShapePointProperties } from '../properties/shapePointProperties';
import type { AnnotationShape } from './annotationShape';
import { PointScene } from './pointScene';
export declare abstract class ShapePointScene<Datum extends ShapePointProperties> extends PointScene<Datum> {
    protected abstract shape: AnnotationShape;
    constructor();
    update(datum: Datum, context: AnnotationContext): void;
    private updateShape;
    protected updateShapeStyles(datum: Datum): void;
    protected updateShapePath(datum: Datum, point: _ModuleSupport.Vec2): void;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
}

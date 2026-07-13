import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext, AnnotationType } from '../annotationTypes';
import { AnnotationShape } from '../scenes/annotationShape';
import { ShapePointScene } from '../scenes/shapePointScene';
import type { ArrowDownProperties } from './arrowDownProperties';
export declare class ArrowDownScene extends ShapePointScene<ArrowDownProperties> {
    static is(value: unknown): value is ArrowDownScene;
    type: AnnotationType;
    protected readonly shape: AnnotationShape;
    constructor();
    updateAnchor(datum: ArrowDownProperties, point: _ModuleSupport.Vec2, context: AnnotationContext): {
        x: number;
        y: number;
        position: "right" | "above" | "above-left" | "below" | undefined;
    };
    protected getHandleCoords(datum: ArrowDownProperties, point: _ModuleSupport.Vec2): _ModuleSupport.Vec2;
}

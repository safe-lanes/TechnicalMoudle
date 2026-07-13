import { _ModuleSupport } from 'ag-charts-community';
import { AnnotationType } from '../annotationTypes';
import { AnnotationShape } from '../scenes/annotationShape';
import { ShapePointScene } from '../scenes/shapePointScene';
import type { ArrowUpProperties } from './arrowUpProperties';
export declare const arrowUpPoints: Array<[number, number]>;
export declare class ArrowUpScene extends ShapePointScene<ArrowUpProperties> {
    static is(value: unknown): value is ArrowUpScene;
    type: AnnotationType;
    protected readonly shape: AnnotationShape;
    constructor();
    protected getHandleCoords(datum: ArrowUpProperties, point: _ModuleSupport.Vec2): _ModuleSupport.Vec2;
}

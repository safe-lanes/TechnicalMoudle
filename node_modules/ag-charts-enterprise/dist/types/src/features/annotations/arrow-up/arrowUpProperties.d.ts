import { AnnotationType } from '../annotationTypes';
import { ShapePointProperties } from '../properties/shapePointProperties';
export declare class ArrowUpProperties extends ShapePointProperties {
    static is(this: void, value: unknown): value is ArrowUpProperties;
    type: AnnotationType.ArrowUp;
}

import { AnnotationType } from '../annotationTypes';
import { ShapePointProperties } from '../properties/shapePointProperties';
export declare class ArrowDownProperties extends ShapePointProperties {
    static is(this: void, value: unknown): value is ArrowDownProperties;
    type: AnnotationType.ArrowDown;
}

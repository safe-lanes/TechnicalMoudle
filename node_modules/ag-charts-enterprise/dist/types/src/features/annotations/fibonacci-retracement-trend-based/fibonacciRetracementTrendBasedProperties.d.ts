import { PointProperties } from '../annotationProperties';
import { AnnotationType } from '../annotationTypes';
import { FibonacciProperties } from '../properties/fibonacciProperties';
export declare class FibonacciRetracementTrendBasedProperties extends FibonacciProperties {
    static is(this: void, value: unknown): value is FibonacciRetracementTrendBasedProperties;
    type: AnnotationType.FibonacciRetracementTrendBased;
    endRetracement: PointProperties;
}

import { AnnotationType } from '../annotationTypes';
import { FibonacciProperties } from '../properties/fibonacciProperties';
export declare class FibonacciRetracementProperties extends FibonacciProperties {
    static is(this: void, value: unknown): value is FibonacciRetracementProperties;
    type: AnnotationType.FibonacciRetracement;
}

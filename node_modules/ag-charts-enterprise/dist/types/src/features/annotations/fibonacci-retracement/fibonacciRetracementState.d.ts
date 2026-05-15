import { LineTypeStateMachine } from '../line/lineState';
import { FibonacciRetracementProperties } from './fibonacciRetracementProperties';
export declare class FibonacciRetracementStateMachine extends LineTypeStateMachine<FibonacciRetracementProperties> {
    createDatum(): FibonacciRetracementProperties;
}

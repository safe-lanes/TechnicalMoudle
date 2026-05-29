import { PointStateMachine } from '../states/pointState';
import { ArrowUpProperties } from './arrowUpProperties';
import type { ArrowUpScene } from './arrowUpScene';
export declare class ArrowUpStateMachine extends PointStateMachine<ArrowUpProperties, ArrowUpScene> {
    protected createDatum(): ArrowUpProperties;
}

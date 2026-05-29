import { PointStateMachine } from '../states/pointState';
import { ArrowDownProperties } from './arrowDownProperties';
import type { ArrowDownScene } from './arrowDownScene';
export declare class ArrowDownStateMachine extends PointStateMachine<ArrowDownProperties, ArrowDownScene> {
    protected createDatum(): ArrowDownProperties;
}

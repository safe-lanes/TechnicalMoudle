import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext, MeasurerPropertiesType } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from '../states/stateTypes';
import { DatePriceRangeProperties, DateRangeProperties, PriceRangeProperties, QuickDatePriceRangeProperties } from './measurerProperties';
import type { MeasurerScene } from './measurerScene';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface MeasurerStateMachineContext<Datum extends MeasurerPropertiesType> extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: Datum) => void;
}
declare abstract class MeasurerTypeStateMachine<Datum extends MeasurerPropertiesType> extends StateMachine<'start' | 'end', Pick<AnnotationStateEvents, 'click' | 'hover' | 'drag' | 'dragEnd' | 'reset' | 'cancel'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: Datum;
    protected node?: MeasurerScene;
    constructor(ctx: MeasurerStateMachineContext<Datum>);
    abstract createDatum(): Datum;
}
export declare class DateRangeStateMachine extends MeasurerTypeStateMachine<DateRangeProperties> {
    createDatum(): DateRangeProperties;
}
export declare class PriceRangeStateMachine extends MeasurerTypeStateMachine<PriceRangeProperties> {
    createDatum(): PriceRangeProperties;
}
export declare class DatePriceRangeStateMachine extends MeasurerTypeStateMachine<DatePriceRangeProperties> {
    createDatum(): DatePriceRangeProperties;
}
export declare class QuickDatePriceRangeStateMachine extends MeasurerTypeStateMachine<QuickDatePriceRangeProperties> {
    createDatum(): QuickDatePriceRangeProperties;
}
export {};

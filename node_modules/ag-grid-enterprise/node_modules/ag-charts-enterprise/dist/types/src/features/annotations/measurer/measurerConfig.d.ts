import type { AnnotationTypeConfig } from '../annotationsSuperTypes';
import { DatePriceRangeProperties, DateRangeProperties, PriceRangeProperties, QuickDatePriceRangeProperties } from './measurerProperties';
import { MeasurerScene, QuickMeasurerScene } from './measurerScene';
export declare const dateRangeConfig: AnnotationTypeConfig<DateRangeProperties, MeasurerScene>;
export declare const priceRangeConfig: AnnotationTypeConfig<PriceRangeProperties, MeasurerScene>;
export declare const datePriceRangeConfig: AnnotationTypeConfig<DatePriceRangeProperties, MeasurerScene>;
export declare const quickDatePriceRangeConfig: AnnotationTypeConfig<QuickDatePriceRangeProperties, QuickMeasurerScene>;

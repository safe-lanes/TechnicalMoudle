import type { ChannelPropertiesType, EphemeralPropertiesType, FibonacciPropertiesType, LinePropertiesType, MeasurerPropertiesType, TextualPropertiesType } from '../annotationsSuperTypes';
export declare function isEphemeralType(datum: unknown): datum is EphemeralPropertiesType;
export declare function isLineType(datum: unknown): datum is LinePropertiesType;
export declare function isChannelType(datum: unknown): datum is ChannelPropertiesType;
export declare function isFibonacciType(datum: unknown): datum is FibonacciPropertiesType;
export declare function isTextType(datum: unknown): datum is TextualPropertiesType;
export declare function isMeasurerType(datum: unknown): datum is MeasurerPropertiesType;

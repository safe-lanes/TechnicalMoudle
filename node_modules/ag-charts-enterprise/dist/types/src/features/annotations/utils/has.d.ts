import type { AnnotationProperties, ChannelPropertiesType, EphemeralPropertiesType, LinePropertiesType, MeasurerPropertiesType, TextualPropertiesType } from '../annotationsSuperTypes';
import { NoteProperties } from '../note/noteProperties';
export declare function hasFontSize(datum?: AnnotationProperties): datum is Exclude<TextualPropertiesType, NoteProperties>;
export declare function hasLineStyle(datum?: AnnotationProperties): datum is Exclude<LinePropertiesType | ChannelPropertiesType | MeasurerPropertiesType, EphemeralPropertiesType>;
export declare function hasLineColor(datum?: AnnotationProperties): boolean;
export declare function hasIconColor(datum?: AnnotationProperties): boolean;
export declare function hasFillColor(datum?: AnnotationProperties): boolean;
export declare function hasTextColor(datum?: AnnotationProperties): boolean;
export declare function hasLineText(datum?: AnnotationProperties): datum is Exclude<LinePropertiesType | ChannelPropertiesType | MeasurerPropertiesType, EphemeralPropertiesType>;

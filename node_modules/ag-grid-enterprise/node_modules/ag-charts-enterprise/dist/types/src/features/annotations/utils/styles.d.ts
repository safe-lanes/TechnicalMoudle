import type { AnnotationLineStyle, AnnotationOptionsColorPickerType } from '../annotationTypes';
import type { AnnotationProperties, ChannelPropertiesType, LinePropertiesType, MeasurerPropertiesType } from '../annotationsSuperTypes';
export declare function setFontSize(datum: AnnotationProperties, fontSize: number): void;
export declare function setLineStyle(datum: LinePropertiesType | ChannelPropertiesType | MeasurerPropertiesType, style?: AnnotationLineStyle): void;
export declare function setColor(datum: AnnotationProperties, colorPickerType: AnnotationOptionsColorPickerType, colorOpacity: string, color: string, opacity: number, isMultiColor: boolean): void;

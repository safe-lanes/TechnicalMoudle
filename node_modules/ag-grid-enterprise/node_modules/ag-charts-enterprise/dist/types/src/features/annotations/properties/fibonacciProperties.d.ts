import { LabelTextProperties } from '../annotationProperties';
import type { AnnotationOptionsColorPickerType, FibonacciBands } from '../annotationTypes';
import { LineTypeProperties } from '../line/lineProperties';
export declare class FibonacciProperties extends LineTypeProperties {
    label: LabelTextProperties;
    reverse: boolean;
    showFill: boolean;
    isMultiColor: boolean;
    strokes: string[];
    rangeStroke?: string;
    bands?: FibonacciBands;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
}

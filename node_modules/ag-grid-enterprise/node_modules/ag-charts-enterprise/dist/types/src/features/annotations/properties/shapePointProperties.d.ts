import { type AnnotationOptionsColorPickerType } from '../annotationTypes';
import { PointProperties } from './pointProperties';
declare const ShapePointProperties_base: {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & typeof PointProperties;
export declare class ShapePointProperties extends ShapePointProperties_base {
    static is(value: unknown): value is ShapePointProperties;
    size: number;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
}
export {};

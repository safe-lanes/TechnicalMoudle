import { AnnotationType } from '../annotationTypes';
import { TextualPointProperties } from '../properties/textualPointProperties';
export declare class TextProperties extends TextualPointProperties {
    static is(this: void, value: unknown): value is TextProperties;
    type: AnnotationType.Text;
    position: "bottom";
}

import { _ModuleSupport } from 'ag-charts-community';
import type { FillOptions } from 'ag-charts-types';
import type { AnnotationContext } from '../annotationTypes';
import type { AnnotationScene } from './annotationScene';
export declare class WithBackgroundScene {
    static updateBackground<Datum extends {
        background: FillOptions;
    }>(this: AnnotationScene & {
        background: _ModuleSupport.Path;
        getBackgroundStyles?(datum: Datum): FillOptions;
        getBackgroundPoints(datum: Datum, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, bounds: _ModuleSupport.Vec4): Array<_ModuleSupport.Vec2>;
    }, datum: Datum, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, context: AnnotationContext): void;
}

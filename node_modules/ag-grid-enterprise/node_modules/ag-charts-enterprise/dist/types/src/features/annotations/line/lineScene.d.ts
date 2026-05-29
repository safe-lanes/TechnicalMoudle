import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import { CollidableText } from '../scenes/collidableTextScene';
import { StartEndScene } from '../scenes/startEndScene';
import type { LineTypeProperties } from './lineProperties';
export declare class LineScene extends StartEndScene<LineTypeProperties> {
    static is(value: unknown): value is LineScene;
    type: string;
    private readonly line;
    text?: CollidableText;
    private startCap?;
    private endCap?;
    constructor();
    update(datum: LineTypeProperties, context: AnnotationContext): void;
    private updateLine;
    private updateText;
    private updateCaps;
    updateAnchor(_datum: LineTypeProperties, coords: _ModuleSupport.Vec4, _context: AnnotationContext, _bbox?: _ModuleSupport.BBox): void;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected getHandleCoords(_datum: LineTypeProperties, coords: _ModuleSupport.Vec4, handle: 'start' | 'end', _bbox?: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: LineTypeProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
}

import { _ModuleSupport } from 'ag-charts-community';
import type { ChannelTextProperties, LineTextProperties } from '../annotationProperties';
import type { CollidableLine } from '../scenes/collidableLineScene';
import { CollidableText } from '../scenes/collidableTextScene';
interface Numbers {
    left: _ModuleSupport.Vec2;
    right: _ModuleSupport.Vec2;
    inset: _ModuleSupport.Vec2;
    offset: _ModuleSupport.Vec2;
    normal: _ModuleSupport.Vec2;
    angle: number;
}
export declare function updateLineText(id: string, line: CollidableLine, coords: _ModuleSupport.Vec4, textProperties?: Partial<LineTextProperties>, textNode?: CollidableText, text?: string, lineWidth?: number): {
    clipMask: {
        x: number;
        y: number;
        radius: number;
    };
    numbers: Numbers;
} | undefined;
export declare function updateChannelText(offsetInsideTextLabel: boolean, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4, textProperties: ChannelTextProperties, lineWidth?: number, textNode?: CollidableText, text?: string): void;
export {};

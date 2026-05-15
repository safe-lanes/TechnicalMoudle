import { type AgAnnotationLineStyleType, _ModuleSupport } from 'ag-charts-community';
import { EventEmitter } from 'ag-charts-core';
import type { ColorPickerOptions } from '../../../components/color-picker/colorPicker';
import { Dialog, type DialogOptions } from '../../../components/dialog/dialog';
import { type ChannelTextPosition, type FibonacciBands, type LineTextAlignment, type LineTextPosition } from '../annotationTypes';
import type { ChannelPropertiesType, EphemeralPropertiesType, FibonacciPropertiesType, LinePropertiesType, MeasurerPropertiesType } from '../annotationsSuperTypes';
export interface LinearSettingsDialogOptions extends DialogOptions {
    initialSelectedTab: 'line' | 'text';
    onChangeLine: (props: LinearSettingsDialogLineChangeProps) => void;
    onChangeText: (props: LinearSettingsDialogTextChangeProps) => void;
    onChangeFillColor: Required<ColorPickerOptions>['onChange'];
    onChangeHideFillColor: Required<ColorPickerOptions>['onChangeHide'];
    onChangeLineColor: Required<ColorPickerOptions>['onChange'];
    onChangeHideLineColor: Required<ColorPickerOptions>['onChangeHide'];
    onChangeLineStyleType: (lineStyleType: AgAnnotationLineStyleType) => void;
    onChangeLineStyleWidth: (strokeWidth: number) => void;
    onChangeTextColor: Required<ColorPickerOptions>['onChange'];
    onChangeHideTextColor: Required<ColorPickerOptions>['onChangeHide'];
    onChangeTextFontSize: (fontSize: number) => void;
}
export interface LinearSettingsDialogLineChangeProps {
    extendStart?: boolean;
    extendEnd?: boolean;
    extendAbove?: boolean;
    extendBelow?: boolean;
    extendLeft?: boolean;
    extendRight?: boolean;
    reverse?: boolean;
    showFill?: boolean;
    bands?: FibonacciBands;
}
export interface LinearSettingsDialogTextChangeProps {
    alignment?: LineTextAlignment;
    position?: LineTextPosition | ChannelTextPosition;
    label?: string;
}
type LinearDialogPropertiesType = Exclude<LinePropertiesType | ChannelPropertiesType | MeasurerPropertiesType | FibonacciPropertiesType, EphemeralPropertiesType>;
interface EventMap {
    hidden: null;
}
export declare class AnnotationSettingsDialog extends Dialog {
    readonly events: EventEmitter<EventMap>;
    constructor(ctx: _ModuleSupport.ModuleContext);
    show(datum: LinearDialogPropertiesType, options: LinearSettingsDialogOptions): void;
    private createLinearLineTab;
    private createLinearTextTab;
    private createColorPickerInput;
    private createStrokeWidthSelect;
    private createFibonacciRatioSelect;
    private createLineStyleRadioGroup;
    private createFontSizeSelect;
    private createPositionRadioGroup;
    private createAlignmentRadioGroup;
}
export {};

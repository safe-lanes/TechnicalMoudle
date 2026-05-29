import { _ModuleSupport } from 'ag-charts-community';
import { type ElementID } from 'ag-charts-core';
import type { AgIconName } from 'ag-charts-types';
declare const DraggablePopover: typeof _ModuleSupport.DraggablePopover;
export interface DialogOptions extends _ModuleSupport.PopoverOptions {
}
interface RadioGroupOptions<T extends string> {
    label: string;
    options: Array<{
        icon: AgIconName;
        altText: string;
        value: T;
    }>;
    value: T;
    onChange: (value: T) => void;
}
interface SelectOptions extends _ModuleSupport.SelectOptions {
    altText: string;
    label: string;
}
interface TextAreaOptions extends _ModuleSupport.TextAreaOptions {
    placeholder: string;
}
interface CheckboxOptions extends _ModuleSupport.CheckboxOptions {
    label: string;
}
interface ColorPickerOptions {
    altText: string;
    label: string;
    color?: string;
    opacity?: number;
    isMultiColor?: boolean;
    hasMultiColorOption: boolean;
    onChange: (colorOpacity: string, color: string, opacity: number, isMultiColor: boolean) => void;
    onChangeHide: () => void;
}
/**
 * A popover that opens at a given position but can be moved by the user. By default, it opens at the bottom right or
 * bottom middle of the chart on charts thinner or wider than 1000px respectively. It will reposition to be
 * constrained within the boundaries of the chart.
 *
 * Dialogs may also contain tabs, inputs and nested color pickers.
 */
export declare abstract class Dialog<Options extends DialogOptions = DialogOptions> extends DraggablePopover<Options> {
    private static readonly offset;
    dragHandleDraggingClass: string;
    private readonly colorPicker;
    private colorPickerAnchorElement?;
    private seriesRect?;
    constructor(ctx: _ModuleSupport.ModuleContext, id: string);
    protected showWithChildren(children: Array<HTMLElement>, options: Options): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    protected updatePosition(position: _ModuleSupport.Vec2): void;
    /**************
     * Containers *
     **************/
    protected createTabs<T extends Record<string, {
        label: string;
        panel: HTMLElement;
        onShow?: () => void;
    }>>(tablistLabel: string, initial: keyof T, tabs: T): {
        tabs: HTMLDivElement & HTMLElement & {
            id: ElementID;
        };
        initialFocus: Record<keyof T, HTMLButtonElement & HTMLElement & {
            id: ElementID;
        }>[keyof T];
    };
    protected createTabPanel(): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    /**********
     * Inputs *
     **********/
    protected createInputGroupLine(): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    protected createRadioGroup<T extends string>({ label, options, value, onChange }: RadioGroupOptions<T>): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    protected createSelect({ altText, label, options, value, onChange }: SelectOptions): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    protected createTextArea({ placeholder, value, onChange }: TextAreaOptions): HTMLTextAreaElement & HTMLElement & {
        id: ElementID;
    };
    protected createCheckbox({ label, checked, onChange }: CheckboxOptions): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    protected createColorPicker({ color, opacity, label, altText, onChange, onChangeHide, isMultiColor, hasMultiColorOption, }: ColorPickerOptions): HTMLDivElement & HTMLElement & {
        id: ElementID;
    };
    /***********
     * Private *
     ***********/
    private createHeaderCloseButton;
    private createInputGroup;
    private onLayoutComplete;
    private onKeyDown;
    private reposition;
    private getColorPickerAnchors;
}
export {};

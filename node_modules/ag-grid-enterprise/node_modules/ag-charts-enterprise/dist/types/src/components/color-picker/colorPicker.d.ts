import { _ModuleSupport } from 'ag-charts-community';
export interface ColorPickerOptions extends _ModuleSupport.AnchoredPopoverOptions {
    color?: string;
    opacity?: number;
    isMultiColor?: boolean;
    hasMultiColorOption: boolean;
    sourceEvent: Event;
    onChange?: (colorOpacity: string, color: string, opacity: number, isMultiColor: boolean) => void;
    onChangeHide?: () => void;
}
export declare class ColorPicker extends _ModuleSupport.AnchoredPopover<ColorPickerOptions> {
    private hasChanged;
    private onChangeHide?;
    private i18nUpdater?;
    constructor(ctx: _ModuleSupport.ModuleContext, options?: _ModuleSupport.PopoverConstructorOptions);
    show(options: ColorPickerOptions): void;
    private createColorPicker;
}

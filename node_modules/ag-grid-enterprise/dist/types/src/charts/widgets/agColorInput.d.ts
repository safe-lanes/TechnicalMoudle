import type { IColor } from 'ag-charts-types';
import type { AgInputTextFieldParams, BeanCollection, ComponentSelector } from 'ag-grid-community';
import { AgInputTextField } from 'ag-grid-community';
type AgColorInputEvent = 'colorChanged';
export declare class AgColorInput extends AgInputTextField<AgInputTextFieldParams, AgColorInputEvent> {
    private chartTranslation;
    private color;
    wireBeans(beans: BeanCollection): void;
    private readonly eColor;
    constructor();
    setColor(color: IColor): void;
    setValue(value?: string | null | undefined, silent?: boolean | undefined): this;
    onColorChanged(callback: (color: IColor) => void): void;
}
export declare const AgColorInputSelector: ComponentSelector;
export {};

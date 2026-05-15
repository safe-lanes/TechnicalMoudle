import type { AgComponentSelectorType, AgEventTypeParams, AgGridCommon, AgPickerFieldParams, BeanCollection, ComponentSelector, GridOptionsService, GridOptionsWithDefaults } from 'ag-grid-community';
import { AgPickerField } from 'ag-grid-community';
import { AgDialog } from '../../widgets/agDialog';
export interface AgColorPickerParams extends Omit<AgPickerFieldParams<AgComponentSelectorType>, 'pickerType' | 'pickerAriaLabelKey' | 'pickerAriaLabelValue'> {
    pickerType?: string;
    pickerAriaLabelKey?: string;
    pickerAriaLabelValue?: string;
}
export declare class AgColorPicker extends AgPickerField<BeanCollection, GridOptionsWithDefaults, AgEventTypeParams, AgGridCommon<any, any>, GridOptionsService, AgComponentSelectorType, string, AgColorPickerParams & AgPickerFieldParams<AgComponentSelectorType>, string, AgDialog> {
    private isDestroyingPicker;
    private eDisplayFieldColor;
    private eDisplayFieldText;
    constructor(config?: AgColorPickerParams);
    postConstruct(): void;
    protected createPickerComponent(): AgDialog;
    protected renderAndPositionPicker(): () => void;
    setValue(color: string): this;
    getValue(): string;
}
export declare const AgColorPickerSelector: ComponentSelector;

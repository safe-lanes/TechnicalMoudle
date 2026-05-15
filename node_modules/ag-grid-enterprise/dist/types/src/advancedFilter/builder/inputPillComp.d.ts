import type { BaseCellDataType, BeanCollection } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
type InputPillCompEvent = 'fieldValueChanged';
export declare class InputPillComp extends Component<InputPillCompEvent> {
    private readonly params;
    private advFilterExpSvc;
    wireBeans(beans: BeanCollection): void;
    private readonly ePill;
    private readonly eLabel;
    private eEditor;
    private value;
    private displayValue;
    constructor(params: {
        value: string;
        valueFormatter: (value: string) => string;
        cssClass: string;
        type: BaseCellDataType;
        ariaLabel: string;
    });
    postConstruct(): void;
    getFocusableElement(): HTMLElement;
    private showEditor;
    /**
     * Responsible for instantiating an InputField and calling some of the setup methods
     */
    private createEditorComp;
    private hideEditor;
    private renderValue;
    private updateValue;
}
export {};

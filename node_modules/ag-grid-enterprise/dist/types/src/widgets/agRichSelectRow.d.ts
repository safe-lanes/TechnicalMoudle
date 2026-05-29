import type { BeanCollection, RichSelectParams } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class RichSelectRow<TValue> extends Component {
    private readonly params;
    private userCompFactory;
    private registry;
    wireBeans(beans: BeanCollection): void;
    private value;
    private parsedValue;
    private tooltipFeature?;
    private shouldDisplayTooltip?;
    constructor(params: RichSelectParams<TValue>);
    postConstruct(): void;
    setState(value: TValue): void;
    highlightString(matchString: string): void;
    updateSelected(selected: boolean): void;
    getValue(): TValue;
    toggleHighlighted(highlighted: boolean): void;
    private populateWithoutRenderer;
    private renderValueWithoutRenderer;
    private populateWithRenderer;
}

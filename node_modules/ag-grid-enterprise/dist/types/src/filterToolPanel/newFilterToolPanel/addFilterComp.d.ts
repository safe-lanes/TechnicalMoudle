import { Component } from 'ag-grid-community';
export declare class AddFilterComp extends Component<'filterSelected'> {
    private eSelect?;
    private removeButton?;
    private options;
    constructor(options: {
        id: string;
        name: string;
    }[]);
    postConstruct(): void;
    refresh(newOptions: {
        id: string;
        name: string;
    }[]): void;
    private showButton;
    private showSelect;
    private setOptions;
    private destroySelect;
    private destroyButton;
    destroy(): void;
}

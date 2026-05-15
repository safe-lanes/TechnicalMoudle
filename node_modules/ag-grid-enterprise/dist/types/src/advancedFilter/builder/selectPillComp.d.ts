import type { RichSelectParams } from 'ag-grid-community';
import { AgRichSelect } from '../../widgets/agRichSelect';
import type { AutocompleteEntry } from '../autocomplete/autocompleteParams';
interface SelectPillParams extends RichSelectParams<AutocompleteEntry> {
    getEditorParams: () => {
        values?: any[];
    };
    wrapperClassName: string;
    ariaLabel: string;
}
export declare class SelectPillComp extends AgRichSelect<AutocompleteEntry> {
    private readonly params;
    constructor(params: SelectPillParams);
    getFocusableElement(): HTMLElement;
    showPicker(): void;
    hidePicker(): void;
    postConstruct(): void;
    protected createPickerComponent(): import("../../widgets/agRichSelectList").AgRichSelectList<AutocompleteEntry, import("../../widgets/agRichSelectList").AgRichSelectListEvent>;
    protected onEnterKeyDown(event: KeyboardEvent): void;
}
export {};

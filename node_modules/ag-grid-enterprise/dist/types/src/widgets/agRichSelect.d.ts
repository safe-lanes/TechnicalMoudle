import type { AgPromise, BeanCollection, ICellRendererComp, RichSelectParams } from 'ag-grid-community';
import { AgPickerField } from 'ag-grid-community';
import type { AgRichSelectListEvent } from './agRichSelectList';
import { AgRichSelectList } from './agRichSelectList';
type AgRichSelectEvent = AgRichSelectListEvent;
export declare class AgRichSelect<TValue = any> extends AgPickerField<TValue[] | TValue, RichSelectParams<TValue>, AgRichSelectEvent, AgRichSelectList<TValue, AgRichSelectEvent>> {
    private userCompFactory;
    private ariaAnnounce?;
    private registry;
    wireBeans(beans: BeanCollection): void;
    private searchStrings?;
    private searchString;
    private listComponent;
    private pillContainer;
    protected values: TValue[];
    private searchStringCreator;
    private readonly eInput;
    private readonly eDeselect;
    private ariaToggleSelection;
    private ariaDeselectAllItems;
    private ariaDeleteSelection;
    private skipWrapperAnnouncement?;
    private tooltipFeature?;
    private shouldDisplayTooltip?;
    constructor(config?: RichSelectParams<TValue>);
    postConstruct(): void;
    private setupAriaProperties;
    private createListComponent;
    private renderSelectedValue;
    protected createPickerComponent(): AgRichSelectList<TValue, AgRichSelectListEvent>;
    setSearchStringCreator(searchStringFn: (values: TValue[]) => string[]): void;
    setValueList(params: {
        valueList: TValue[];
        refresh?: boolean;
    }): void;
    /**
     * This method updates the list of values
     */
    private setValues;
    showPicker(): void;
    protected beforeHidePicker(): void;
    private createOrUpdatePillContainer;
    private doWhileBlockingAnnouncement;
    private onWrapperFocus;
    private onWrapperFocusOut;
    private onDeselectAllMouseDown;
    private onDeselectAllClick;
    private buildSearchStringFromKeyboardEvent;
    private searchTextFromCharacter;
    searchTextFromString(str: string | null | undefined): void;
    private getSearchStringsFromValues;
    private filterListModel;
    private runSearch;
    private highlightEmptyValue;
    private highlightListValue;
    private getSuggestionsAndFilteredValues;
    private displayOrHidePicker;
    private clearSearchString;
    setValue(value: TValue[] | TValue | null, silent?: boolean, fromPicker?: boolean, skipRendering?: boolean): this;
    private onNavigationKeyDown;
    protected onEnterKeyDown(e: KeyboardEvent): void;
    private onDeleteKeyDown;
    private onTabKeyDown;
    private getValueFromSet;
    private onListValueSelected;
    private dispatchPickerEventAndHidePicker;
    getFocusableElement(): HTMLElement;
    protected onKeyDown(e: KeyboardEvent): void;
    private announceAriaValue;
    destroy(): void;
}
/**
 * cell renderers are used in a few places. they bind to dom slightly differently to other cell renders as they
 * can return back strings (instead of html element) in the getGui() method. common code placed here to handle that.
 * @param {AgPromise<ICellRendererComp>} cellRendererPromise
 * @param {HTMLElement} eTarget
 */
export declare function _bindCellRendererToHtmlElement(cellRendererPromise: AgPromise<ICellRendererComp>, eTarget: HTMLElement): void;
export {};

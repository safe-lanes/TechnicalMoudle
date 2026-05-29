import type { BeanStub } from 'ag-grid-community';
declare const DEFAULT_LOCALE_TEXT: {
    readonly addFilterCard: "Add Filter";
    readonly ariaLabelAddFilterField: "Add Filter Field";
    readonly ariaLabelFilterCardDelete: "Delete Filter";
    readonly ariaLabelFilterCardHasEdits: "Has Edits";
    readonly agTextColumnFilterDisplayName: "Simple Filter";
    readonly agNumberColumnFilterDisplayName: "Simple Filter";
    readonly agDateColumnFilterDisplayName: "Simple Filter";
    readonly agSetColumnFilterDisplayName: "Selection Filter";
    readonly agMultiColumnFilterDisplayName: "Combo Filter";
    readonly addFilterPlaceholder: "Search columns...";
};
export declare function translateForFilterPanel(bean: BeanStub<any>, key: keyof typeof DEFAULT_LOCALE_TEXT): string;
export declare function compareAndUpdateListsInDom(eContainer: HTMLElement, eNewItems: HTMLElement[], ePrevItems: HTMLElement[]): void;
export {};

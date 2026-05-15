import type { BeanCollection } from 'ag-grid-community';
/**
 * FF and Safari remove text selections when the focus changes. This is inconsistent with Chrome, whose behaviour
 * we prefer in this case. This utility preserves whatever text selection exists before the given action is taken.
 */
export declare function _preserveRangesWhile(beans: BeanCollection, fn: () => void): void;

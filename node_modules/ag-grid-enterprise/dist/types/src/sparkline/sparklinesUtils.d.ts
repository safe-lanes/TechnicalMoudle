type FunctionParams = (...args: any[]) => any;
type WrapperFunctionParams = (fn: FunctionParams, ...args: any[]) => any;
export declare const wrapFn: (fn: FunctionParams, wrapperFn: WrapperFunctionParams) => FunctionParams;
export {};

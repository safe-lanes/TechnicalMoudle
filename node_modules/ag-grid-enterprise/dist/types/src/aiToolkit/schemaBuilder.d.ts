import type { AnyOfSchema, ArraySchema, BooleanSchema, EnumSchema, JSONSchema, JSONSchemaType, NumberSchema, ObjectSchema, ReferencedProperty, StringFormat, StringSchema } from './schemaTypes';
export interface SchemaBuilder {
    toJSON(): JSONSchema;
    nullable(): SchemaBuilder;
}
declare abstract class BaseSchemaBuilder<TType extends JSONSchemaType> {
    abstract type: TType;
    description?: string;
    _defs: Record<string, JSONSchema>;
    _nullable: boolean;
    constructor(description?: string);
    _collectNestedDefs(schemas: JSONSchema[]): Record<string, JSONSchema>;
    _toJSON(additionalProperties?: Record<string, any>): any;
    nullable(): this;
    define(id: string, schema: JSONSchema): this;
}
declare class StringSchemaBuilder extends BaseSchemaBuilder<'string'> {
    readonly type = "string";
    _pattern?: string;
    _format?: StringFormat;
    constructor(descriptionOrOptions?: string | {
        pattern?: string;
        format?: StringFormat;
        description?: string;
    });
    pattern(input: string): this;
    format(input: StringFormat): this;
    toJSON(): StringSchema;
}
declare class NumberSchemaBuilder extends BaseSchemaBuilder<'number' | 'integer'> {
    readonly type = "number";
    _minimum?: number;
    _exclusiveMinimum?: number;
    _maximum?: number;
    _exclusiveMaximum?: number;
    _multipleOf?: number;
    constructor(descriptionOrOptions?: string | {
        minimum?: number;
        maximum?: number;
        exclusiveMinimum?: number;
        exclusiveMaximum?: number;
        multipleOf?: number;
        description?: string;
    });
    minimum(value: number): this;
    exclusiveMinimum(value: number): this;
    maximum(value: number): this;
    exclusiveMaximum(value: number): this;
    multipleOf(value: number): this;
    toJSON(): NumberSchema;
}
declare class EnumSchemaBuilder extends BaseSchemaBuilder<'string'> {
    readonly _enum: string[];
    readonly type = "string";
    constructor(_enum: string[], description?: string);
    toJSON(): EnumSchema;
}
declare class LiteralSchemaBuilder extends EnumSchemaBuilder {
    constructor(value: string, description?: string);
}
declare class BooleanSchemaBuilder extends BaseSchemaBuilder<'boolean'> {
    readonly type = "boolean";
    constructor(description?: string);
    toJSON(): BooleanSchema;
}
declare class ArraySchemaBuilder extends BaseSchemaBuilder<'array'> {
    readonly items: SchemaBuilder;
    readonly type = "array";
    _minItems?: number;
    _maxItems?: number;
    constructor(items: SchemaBuilder, descriptionOrOptions?: string | {
        minItems?: number;
        maxItems?: number;
        description?: string;
    });
    minItems(value: number): this;
    maxItems(value: number): this;
    toJSON(): ArraySchema;
}
declare class ObjectSchemaBuilder extends BaseSchemaBuilder<'object'> {
    readonly properties: Record<string, SchemaBuilder>;
    readonly type = "object";
    constructor(properties: Record<string, SchemaBuilder>, description?: string);
    toJSON(): ObjectSchema;
}
declare class UnionSchemaBuilder {
    private readonly schemas;
    private _nullable;
    private _defs;
    constructor(schemas: SchemaBuilder[], description?: string);
    description?: string;
    nullable(): this;
    define(id: string, schema: JSONSchema): this;
    protected _collectNestedDefs(schemas: JSONSchema[]): Record<string, JSONSchema>;
    toJSON(): AnyOfSchema;
}
declare class ReferenceSchemaBuilder {
    private readonly id;
    constructor(id: string);
    nullable(): this;
    toJSON(): ReferencedProperty;
}
export declare const s: {
    readonly string: (descriptionOrOptions?: string | {
        pattern?: string;
        format?: StringFormat;
        description?: string;
    }) => StringSchemaBuilder;
    readonly number: (descriptionOrOptions?: string | {
        minimum?: number;
        maximum?: number;
        exclusiveMinimum?: number;
        exclusiveMaximum?: number;
        multipleOf?: number;
        description?: string;
    }) => NumberSchemaBuilder;
    readonly enum: (values: string[], description?: string) => EnumSchemaBuilder;
    readonly boolean: (description?: string) => BooleanSchemaBuilder;
    readonly array: (items: SchemaBuilder, descriptionOrOptions?: string | {
        minItems?: number;
        maxItems?: number;
        description?: string;
    }) => ArraySchemaBuilder;
    readonly object: (properties: Record<string, SchemaBuilder>, description?: string) => ObjectSchemaBuilder;
    readonly union: (schemas: SchemaBuilder[], description?: string) => UnionSchemaBuilder;
    readonly literal: (value: string, description?: string) => LiteralSchemaBuilder;
    readonly ref: (id: string) => ReferenceSchemaBuilder;
};
export {};

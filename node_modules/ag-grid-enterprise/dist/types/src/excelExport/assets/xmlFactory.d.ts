import type { HeaderElement, XmlElement } from 'ag-grid-community';
export declare function createXmlHeader(headerElement?: HeaderElement): string;
export declare function createXml(xmlElement: XmlElement, booleanTransformer?: (currentValue: boolean) => string): string;

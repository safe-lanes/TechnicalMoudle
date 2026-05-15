export interface ZipFile {
    path: string;
    created: Date;
    isBase64: boolean;
    type: 'file' | 'folder';
    content?: string | Uint8Array;
}
export declare class ZipContainer {
    private folders;
    private files;
    addFolders(paths: string[]): void;
    private addFolder;
    addFile(path: string, content: string, isBase64?: boolean): void;
    getZipFile(mimeType?: string): Promise<Blob>;
    getUncompressedZipFile(mimeType?: string): Blob;
    private clearStream;
    private packageFiles;
    private buildCompressedFileStream;
    private buildFileStream;
}

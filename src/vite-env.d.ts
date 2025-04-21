/// <reference types="vite/client" />

// Basic types
type FileSystemPermissionMode = "read" | "readwrite";
type FileSystemHandleKind = "file" | "directory";

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

// FileSystemHandle (shared between file and directory)
interface FileSystemHandle {
  readonly kind: FileSystemHandleKind;
  readonly name: string;

  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(
    descriptor?: FileSystemPermissionDescriptor
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemPermissionDescriptor
  ): Promise<PermissionState>;
}

interface FileSystemPermissionDescriptor {
  mode?: "read" | "readwrite";
}

// FileSystemFileHandle
interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: "file";

  getFile(): Promise<File>;
  createWritable(
    options?: FileSystemCreateWritableOptions
  ): Promise<FileSystemWritableFileStream>;
}

// FileSystemDirectoryHandle
interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: "directory";

  getFileHandle(
    name: string,
    options?: GetFileHandleOptions
  ): Promise<FileSystemFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: GetDirectoryHandleOptions
  ): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: RemoveEntryOptions): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

// Writable stream for saving files
interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | WriteParams): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
}

interface WriteParams {
  type: "write";
  position?: number;
  data: BufferSource | Blob | string;
}

// Options
interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface GetFileHandleOptions {
  create?: boolean;
}

interface GetDirectoryHandleOptions {
  create?: boolean;
}

interface RemoveEntryOptions {
  recursive?: boolean;
}

// File picker options
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

type StartInType =
  | "desktop"
  | "documents"
  | "downloads"
  | "pictures"
  | "videos"
  | "music"
  | FileSystemHandle;

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  startIn?: FileSystemHandle | string;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: FileSystemPermissionMode;
  startIn?: FileSystemHandle | string;
}

// Global functions
declare function showOpenFilePicker(
  options?: OpenFilePickerOptions
): Promise<FileSystemFileHandle[]>;
declare function showSaveFilePicker(
  options?: SaveFilePickerOptions
): Promise<FileSystemFileHandle>;
declare function showDirectoryPicker(
  options?: DirectoryPickerOptions
): Promise<FileSystemDirectoryHandle>;

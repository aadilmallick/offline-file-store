type FileAcceptType = {
  description: string;
  accept: Record<string, string[]>; // MIME type to file extension
};

export class FileSystemManager {
  static async getFileSize(handle: FileSystemFileHandle) {
    const file = await handle.getFile();
    return file.size;
  }
  // region READ
  static async openSingleFile(types: FileAcceptType[]) {
    const [fileHandle] = await window.showOpenFilePicker({
      types,
      excludeAcceptAllOption: true,
      multiple: false,
    });
    return fileHandle;
  }

  static async openMultipleFiles(types: FileAcceptType[]) {
    const fileHandles = await window.showOpenFilePicker({
      types,
      excludeAcceptAllOption: true,
      multiple: true,
    });
    return fileHandles;
  }

  static async openDirectory({
    mode = "read",
    startIn,
  }: {
    mode?: "read" | "readwrite";
    startIn?: StartInType;
  }) {
    const dirHandle = await window.showDirectoryPicker({
      mode: mode,
      startIn: startIn,
    });
    return dirHandle;
  }

  static async readDirectoryHandle(dirHandle: FileSystemDirectoryHandle) {
    const values = await Array.fromAsync(dirHandle.values());
    return values;
  }

  static async getDirectoryContentNames(dirHandle: FileSystemDirectoryHandle) {
    const keys = await Array.fromAsync(dirHandle.keys());
    return keys;
  }

  static async isDescendant(
    ancestor: FileSystemDirectoryHandle,
    maybeDescendant: FileSystemDirectoryHandle
  ): Promise<boolean> {
    // Direct match
    if (await ancestor.isSameEntry(maybeDescendant)) {
      return true;
    }
    // Traverse subtree using identity comparison
    for await (const entry of ancestor.values()) {
      if (entry.kind === "directory") {
        const dir = entry as FileSystemDirectoryHandle;
        if (await dir.isSameEntry(maybeDescendant)) {
          return true;
        }
        if (await this.isDescendant(dir, maybeDescendant)) {
          return true;
        }
      }
    }
    return false;
  }
  static async getStorageInfo() {
    const estimate = await navigator.storage.estimate();
    if (!estimate.quota || !estimate.usage) {
      throw new Error("Storage estimate not available");
    }
    return {
      storagePercentageUsed: (estimate.usage / estimate.quota) * 100,
      bytesUsed: estimate.usage,
      bytesAvailable: estimate.quota,
    };
  }

  /**
   * Recursively walks through a directory handle and returns all files
   * @param dirHandle The directory handle to walk through
   * @param path The current path (used for recursion)
   * @returns An array of objects containing file handles and their paths
   */
  static async walk(
    dirHandle: FileSystemDirectoryHandle,
    path: string = ""
  ): Promise<Array<{ handle: FileSystemFileHandle; path: string }>> {
    const results: Array<{ handle: FileSystemFileHandle; path: string }> = [];
    const entries = await this.readDirectoryHandle(dirHandle);

    for (const entry of entries) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === "file") {
        results.push({
          handle: entry as FileSystemFileHandle,
          path: entryPath,
        });
      } else if (entry.kind === "directory") {
        // Recursively walk through subdirectories
        const subDirHandle = entry as FileSystemDirectoryHandle;
        const subResults = await this.walk(subDirHandle, entryPath);
        results.push(...subResults);
      }
    }

    return results;
  }

  static getFileFromDirectory(
    dirHandle: FileSystemDirectoryHandle,
    filename: string
  ) {
    return dirHandle.getFileHandle(filename, { create: false });
  }

  static async getFileDataFromHandle(
    handle: FileSystemFileHandle,
    options?: {
      type?: "blobUrl" | "file" | "arrayBuffer";
    }
  ): Promise<File | string | ArrayBuffer> {
    const file = await handle.getFile();

    if (options?.type === "blobUrl") {
      return URL.createObjectURL(file);
    }

    if (options?.type === "arrayBuffer") {
      return file.arrayBuffer();
    }

    // Default return type is File
    return file;
  }

  // region CREATE
  static createFileFromDirectory(
    dirHandle: FileSystemDirectoryHandle,
    filename: string
  ) {
    return dirHandle.getFileHandle(filename, { create: true });
  }

  // region DELETE
  static deleteFileFromDirectory(
    dirHandle: FileSystemDirectoryHandle,
    filename: string
  ) {
    return dirHandle.removeEntry(filename);
  }

  static deleteFolderFromDirectory(
    dirHandle: FileSystemDirectoryHandle,
    folderName: string
  ) {
    return dirHandle.removeEntry(folderName, {
      recursive: true,
    });
  }

  // region MOVE
  static async moveFile(
    sourceDirHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle,
    destinationDirHandle: FileSystemDirectoryHandle
  ) {
    const file = await fileHandle.getFile();
    const newFileHandle = await destinationDirHandle.getFileHandle(file.name, {
      create: true,
    });
    const writable = await newFileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    await sourceDirHandle.removeEntry(file.name);
  }

  static async moveFolder(
    sourceDirHandle: FileSystemDirectoryHandle,
    folderHandle: FileSystemDirectoryHandle,
    destinationDirHandle: FileSystemDirectoryHandle
  ) {
    const newFolderHandle = await destinationDirHandle.getDirectoryHandle(
      folderHandle.name,
      { create: true }
    );
    for await (const entry of folderHandle.values()) {
      if (entry.kind === "file") {
        await this.moveFile(folderHandle, entry, newFolderHandle);
      } else {
        await this.moveFolder(folderHandle, entry, newFolderHandle);
      }
    }
    await sourceDirHandle.removeEntry(folderHandle.name);
  }

  static async moveEntry(
    sourceDirHandle: FileSystemDirectoryHandle,
    entryHandle: FileSystemDirectoryHandle | FileSystemFileHandle,
    destinationDirHandle: FileSystemDirectoryHandle
  ) {
    if (entryHandle.kind === "file") {
      await this.moveFile(sourceDirHandle, entryHandle, destinationDirHandle);
    } else {
      await this.moveFolder(sourceDirHandle, entryHandle, destinationDirHandle);
    }
  }

  // endregion

  // region WRITE

  static async saveTextFile(text: string) {
    const fileHandle = await window.showSaveFilePicker({
      types: [
        {
          description: "Text files",
          accept: {
            "text/*": [".txt", ".md", ".html", ".css", ".js", ".json"],
          },
        },
      ],
    });
    await this.writeData(fileHandle, text);
  }

  static FileTypes = {
    getTextFileTypes: () => {
      return {
        description: "Text files",
        accept: {
          "text/*": [".txt", ".md", ".html", ".css", ".js", ".json"],
        },
      };
    },
    getVideoFileTypes: () => {
      return {
        description: "Video files",
        accept: {
          "video/*": [".mp4", ".avi", ".mkv", ".mov", ".webm"],
        },
      };
    },
    getImageFileTypes: () => {
      return {
        description: "Image files",
        accept: {
          "image/*": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"],
        },
      };
    },
  };

  static async saveFile(options: {
    data: Blob | string;
    types?: FileAcceptType[];
    name?: string;
    startIn?: StartInType;
  }) {
    const fileHandle = await window.showSaveFilePicker({
      types: options.types,
      suggestedName: options.name,
      startIn: options.startIn,
    });
    await this.writeData(fileHandle, options.data);
  }

  private static async writeData(
    fileHandle: FileSystemFileHandle,
    data: Blob | string
  ) {
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }
}

export class OPFS {
  private root!: FileSystemDirectoryHandle;

  constructor(root?: FileSystemDirectoryHandle) {
    if (root) {
      this.root = root;
    }
  }

  async initOPFS() {
    try {
      this.root = await navigator.storage.getDirectory();
      return true;
    } catch (e) {
      console.error("Error opening directory:", e);
      return false;
    }
  }

  public get directoryHandle() {
    return this.root;
  }

  public get initialized() {
    return !!this.root;
  }

  private validate(): this is { root: FileSystemDirectoryHandle } {
    if (!this.root) {
      throw new Error("Root directory not set");
    }
    return true;
  }

  async getDirectoryContents() {
    this.validate();
    return await FileSystemManager.readDirectoryHandle(this.root);
  }

  async getFilesAndFolders() {
    this.validate();
    const entries = await FileSystemManager.readDirectoryHandle(this.root);
    const files = entries.filter(
      (entry) => entry.kind === "file"
    ) as FileSystemFileHandle[];
    const folders = entries.filter(
      (entry) => entry.kind === "directory"
    ) as FileSystemDirectoryHandle[];
    return {
      files,
      folders,
    };
  }

  async createFileHandle(filename: string) {
    this.validate();
    return await FileSystemManager.createFileFromDirectory(this.root, filename);
  }

  async createDirectory(folderName: string) {
    this.validate();
    const dirHandle = await this.root.getDirectoryHandle(folderName, {
      create: true,
    });
    return new OPFS(dirHandle);
  }

  async getDirectoryContentNames() {
    this.validate();
    return await FileSystemManager.getDirectoryContentNames(this.root);
  }

  async getFileHandle(filename: string) {
    this.validate();
    return await FileSystemManager.getFileFromDirectory(this.root, filename);
  }

  async deleteFile(filename: string) {
    this.validate();
    await FileSystemManager.deleteFileFromDirectory(this.root, filename);
  }

  async deleteFolder(folderName: string) {
    this.validate();
    await FileSystemManager.deleteFolderFromDirectory(this.root, folderName);
  }

  async move(
    entryHandle: FileSystemDirectoryHandle | FileSystemFileHandle,
    destination: FileSystemDirectoryHandle
  ) {
    this.validate();
    await FileSystemManager.moveEntry(this.root, entryHandle, destination);
  }

  static async writeDataToFileHandle(
    file: FileSystemFileHandle,
    data: string | Blob | ArrayBuffer
  ) {
    const writable = await file.createWritable();
    await writable.write(data);
    await writable.close();
  }
}

export class DirectoryNavigationStack {
  constructor(
    private root: FileSystemDirectoryHandle,
    private stack: FileSystemDirectoryHandle[] = []
  ) {}

  public get isRoot() {
    return this.stack.length === 0;
  }

  public get fsRoot() {
    return this.root;
  }

  public get size() {
    return this.stack.length;
  }

  public push(dirHandle: FileSystemDirectoryHandle) {
    this.stack.push(dirHandle);
  }

  public pop() {
    return this.stack.pop();
  }

  public get currentDirectory() {
    return this.stack.at(-1) || this.root;
  }

  public get parentDirectoryHandle() {
    return this.stack.at(-2) || this.root;
  }

  public get currentFolderPath() {
    if (this.isRoot) {
      return "/" + this.root.name;
    }
    return "/" + [this.root.name, ...this.stack.map((d) => d.name)].join("/");
  }

  public get parentFolderPath() {
    if (this.isRoot) {
      return "/" + this.root.name;
    }
    return (
      "/" +
      [this.root.name, ...this.stack.slice(0, -1).map((d) => d.name)].join("/")
    );
  }
}

export class FileHandleModel {
  constructor(public handle: FileSystemFileHandle) {}

  getFileData() {
    return this.handle.getFile();
  }

  async getFileSize() {
    const file = await this.getFileData();
    return file.size;
  }

  async getFileAsBlobUrl() {
    const file = await this.getFileData();
    return URL.createObjectURL(file);
  }
}

export function humanFileSize(bytes: number, dp = 1) {
  const thresh = 1000;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + " " + units[u];
}

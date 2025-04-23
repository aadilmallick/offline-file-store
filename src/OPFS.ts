type FileAcceptType = {
  description: string;
  accept: Record<string, string[]>; // MIME type to file extension
};

export class FileSystemManager {
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
}

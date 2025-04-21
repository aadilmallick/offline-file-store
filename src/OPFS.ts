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

import { create } from "zustand";

type Store = {
  fileSizeInDirectory: number;
  setFileSizeInDirectory: (size: number) => void;
  addFileSize: (size: number) => void;
  removeFileSize: (size: number) => void;
};

export const useAppStore = create<Store>()((set) => ({
  fileSizeInDirectory: 0,
  setFileSizeInDirectory: (size) => set(() => ({ fileSizeInDirectory: size })),
  addFileSize: (size) =>
    set((state) => ({
      fileSizeInDirectory: state.fileSizeInDirectory + size,
    })),
  removeFileSize: (size) =>
    set((state) => ({
      fileSizeInDirectory: state.fileSizeInDirectory - size,
    })),
}));

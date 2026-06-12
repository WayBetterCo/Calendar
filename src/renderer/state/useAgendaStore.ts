import { create } from 'zustand';
import type { CalendarEvent } from '../types/calendar';

type AgendaState = {
  selectedDate: Date;
  search: string;
  searchOpen: boolean;
  settingsOpen: boolean;
  createDate: Date | null;
  editingEvent: CalendarEvent | null;
  setSelectedDate: (date: Date) => void;
  setSearch: (search: string) => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openCreate: (date: Date) => void;
  closeCreate: () => void;
  openEdit: (event: CalendarEvent) => void;
  closeEdit: () => void;
};

export const useAgendaStore = create<AgendaState>((set) => ({
  selectedDate: new Date(),
  search: '',
  searchOpen: false,
  settingsOpen: false,
  createDate: null,
  editingEvent: null,
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSearch: (search) => set({ search }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  openCreate: (createDate) => set({ createDate, editingEvent: null }),
  closeCreate: () => set({ createDate: null }),
  openEdit: (editingEvent) => set({ editingEvent, createDate: null }),
  closeEdit: () => set({ editingEvent: null }),
}));

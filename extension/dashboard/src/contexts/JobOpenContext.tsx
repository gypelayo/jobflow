import { createContext } from 'preact';

type Handler = (id: number) => void;

export const JobOpenContext = createContext<{
  register: (fn: Handler) => (() => void);
  open: (id: number) => void;
}>({
  register: () => () => {},
  open: () => {},
});

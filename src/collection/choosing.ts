// src/collection/choosing.ts: which pieces are chosen while Select is on (src/collection/Choose.tsx draws it). A long press begins
// Select with that piece chosen; the click that ends the long press is not a tap, so it neither opens nor unchooses the piece.
import { useRef, useState } from 'react';

export interface Choosing {
  on: boolean;
  chosen: ReadonlySet<string>;
  /** Select, from the Select button */
  begin: () => void;
  /** Select from a long press on a piece: it starts chosen */
  held: (id: string) => void;
  /** a click on a piece: true when it ends a long press and must do nothing */
  endsHold: () => boolean;
  /** a finger comes down on a piece: a new press, so the next click is a tap */
  pressed: () => void;
  toggle: (id: string) => void;
  end: () => void;
}

export function useChoosing(): Choosing {
  const [on, setOn] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const afterHold = useRef(false);
  return {
    on,
    chosen,
    begin: () => {
      setChosen(new Set());
      setOn(true);
    },
    held: (id) => {
      afterHold.current = true;
      setChosen(new Set([id]));
      setOn(true);
    },
    endsHold: () => {
      const was = afterHold.current;
      afterHold.current = false;
      return was;
    },
    pressed: () => {
      afterHold.current = false;
    },
    toggle: (id) =>
      setChosen((was) => {
        const next = new Set(was);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    end: () => {
      afterHold.current = false;
      setOn(false);
      setChosen(new Set());
    },
  };
}

// src/wishlist/GotItSheet.tsx: Got it! on a wished coin: what did he pay (the asking price is already in the box, to change if it was
// different), then the coin moves into the Collection as confirmed, with its photos and what was paid.
import type { Item } from '../data/db';
import { getGoal, gotIt, setGoal } from '../data/repositories';
import { MoneySheet } from './MoneySheet';

export function GotItSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  return (
    <MoneySheet
      title="Got it!"
      label="What did you pay? (US dollars)"
      initial={item.askingPrice ? String(item.askingPrice) : ''}
      keepLabel="Add to my Collection"
      onClose={onClose}
      onKeep={async (paid) => {
        await gotIt(item.id, paid);
        if ((await getGoal()) === item.id) await setGoal(null);
        onClose();
      }}
    />
  );
}

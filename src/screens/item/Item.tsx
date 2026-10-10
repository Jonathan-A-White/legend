// src/screens/item/Item.tsx: one item of the collection, at #/item/<id>. A placeholder until its story builds it.
import { Placeholder } from '../../ui/Placeholder';

export function Item({ id }: { id: string }) {
  return (
    <Placeholder title="Item">
      The photographs, the name and the story of one coin or banknote will be here. This one is {id}.
    </Placeholder>
  );
}

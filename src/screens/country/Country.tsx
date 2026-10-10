// src/screens/country/Country.tsx: what the collection holds from one country, at #/country/<cc>. A placeholder until its story builds it.
import { Placeholder } from '../../ui/Placeholder';

export function Country({ code }: { code: string }) {
  return <Placeholder title={`Country ${code}`}>Every coin and banknote you have from this country will be here.</Placeholder>;
}

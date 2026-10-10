// src/collection/useReference.ts: the world's country names and the US mints, loaded once from the files the app ships, as the
// lookups the matcher and the screens use. Until they arrive (or if they cannot, offline cache aside) a country shows as its code.
import { useEffect, useMemo, useState } from 'react';
import { countryName, flagOf, loadCountries, type Countries } from '../data/world';
import { loadMints, type Mint } from '../data/us';
import type { SearchLookups } from './search';

let mintsLoad: Promise<Mint[]> | undefined;
const loadMintsOnce = (): Promise<Mint[]> => {
  mintsLoad ??= loadMints().catch(() => {
    mintsLoad = undefined;
    return [];
  });
  return mintsLoad;
};

export interface Reference extends SearchLookups {
  flag(cc: string): string;
  /** every country by name, for a list to choose from; empty until loaded */
  countryList: { code: string; name: string; flag: string }[];
}

export function useReference(): Reference {
  const [countries, setCountries] = useState<Countries | null>(null);
  const [mints, setMints] = useState<Mint[]>([]);
  useEffect(() => {
    let live = true;
    loadCountries().then((c) => live && setCountries(c), () => undefined);
    loadMintsOnce().then((m) => live && setMints(m));
    return () => {
      live = false;
    };
  }, []);
  return useMemo(
    () => ({
      countryName: (cc) => (countries ? countryName(countries, cc) : cc),
      mintCity: (mark, country) => (country === 'US' ? (mints.find((m) => m.mark === mark.toUpperCase())?.city ?? null) : null),
      flag: flagOf,
      countryList: countries
        ? Object.entries(countries.names)
            .map(([code, info]) => ({ code, name: info.name, flag: info.flag }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    }),
    [countries, mints],
  );
}

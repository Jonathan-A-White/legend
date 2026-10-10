// src/capture/useCountries.ts: the world's countries by name with their flags, loaded once from the files the app ships, for the
// Confirm sheet's country list. Empty until loaded; a country is then drawn as its code.
import { useEffect, useState } from 'react';
import { loadCountries } from '../data/world';

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export function useCountries(): CountryOption[] {
  const [list, setList] = useState<CountryOption[]>([]);
  useEffect(() => {
    let live = true;
    loadCountries().then(
      (countries) => live && setList(Object.entries(countries.names).map(([code, info]) => ({ code, name: info.name, flag: info.flag })).sort((a, b) => a.name.localeCompare(b.name))),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return list;
}

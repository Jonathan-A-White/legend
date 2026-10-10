// Small slices of the world-data sources for the data-build tests: never the network, never the real files.
import type { RawTopology } from '../../scripts/data-build';

// A topology of seven shapes: five with a numeric id, Kosovo and Somaliland without (as in world-atlas).
export const topologySlice: RawTopology = {
  type: 'Topology',
  objects: {
    countries: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], id: '840', properties: { name: 'United States of America' } },
        { type: 'Polygon', arcs: [[1]], id: '276', properties: { name: 'Germany' } },
        { type: 'Polygon', arcs: [[2]], id: '392', properties: { name: 'Japan' } },
        { type: 'Polygon', arcs: [[3]], properties: { name: 'Kosovo' } },
        { type: 'Polygon', arcs: [[4]], properties: { name: 'Somaliland' } },
        { type: 'Polygon', arcs: [[5]], id: '090', properties: { name: 'Solomon Is.' } },
        { type: 'Polygon', arcs: [[6]], id: '478', properties: { name: 'Mauritania' } },
      ],
    },
    land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0], [1], [2]], properties: { name: 'land' } }] },
  },
  arcs: [
    [[0, 0], [10, 0], [0, 10], [-10, 0]],
    [[20, 0], [10, 0], [0, 10], [-10, 0]],
    [[40, 0], [10, 0], [0, 10], [-10, 0]],
    [[60, 0], [10, 0], [0, 10], [-10, 0]],
    [[80, 0], [10, 0], [0, 10], [-10, 0]],
    [[100, 0], [10, 0], [0, 10], [-10, 0]],
    [[120, 0], [10, 0], [0, 10], [-10, 0]],
  ],
  transform: { scale: [1, 1], translate: [-180, -90] },
  bbox: [-180, -90, 180, 90],
};

// Only the columns the build reads, in the order the real file has them; one value has a comma inside quotes.
export const countryCodesCsv = [
  'ISO3166-1-numeric,ISO3166-1-Alpha-2,CLDR display name,official_name_en,UNTERM English Short,ISO4217-currency_country_name,ISO4217-currency_alphabetic_code,ISO4217-currency_name,Continent',
  '840,US,US,United States of America,United States of America (the),UNITED STATES OF AMERICA,USD,US Dollar,NA',
  '276,DE,Germany,Germany,Germany,GERMANY,EUR,Euro,EU',
  '392,JP,Japan,Japan,Japan,JAPAN,JPY,Yen,AS',
  '90,SB,Solomon Islands,Solomon Islands,Solomon Islands,SOLOMON ISLANDS,SBD,Solomon Islands Dollar,OC',
  '478,MR,"Mauritania, Islamic Republic of",Mauritania,Mauritania,MAURITANIA,MRU,Ouguiya,AF',
].join('\n');

// ISO 4217 codes-all.csv: current codes have no WithdrawalDate; DEM is historic and its entity is GERMANY.
export const isoCodesCsv = [
  'Entity,Currency,AlphabeticCode,NumericCode,MinorUnit,WithdrawalDate',
  'UNITED STATES OF AMERICA (THE),US Dollar,USD,840,2,',
  'GERMANY,Euro,EUR,978,2,',
  'JAPAN,Yen,JPY,392,0,',
  'GERMANY,Deutsche Mark,DEM,276,2,2002-03',
  'JAPAN,Old Yen,JPO,999,0,1950-01',
  'ATLANTIS,Shell,ATS,998,2,1900-01',
].join('\n');

// The rows of the committed Wikidata snapshot (data/snapshots/wikidata-currencies.json).
export const wikidataSlice = [
  { cc: 'US', code: 'USD', name: 'United States dollar', from: '1792-04-02', to: null },
  { cc: 'DE', code: 'EUR', name: 'euro', from: '2002-01-01', to: null },
  { cc: 'DE', code: 'DEM', name: 'Deutsche Mark', from: '1948-06-21', to: '2001-12-31' },
  { cc: 'DE', code: null, name: 'reichsmark', from: '1924-08-30', to: '1948-06-20' },
  { cc: 'JP', code: 'JPY', name: 'yen', from: null, to: null },
];

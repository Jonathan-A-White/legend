// Sample answers of the coin-from-photos grind, shaped as schemas/coin-from-photos-answer-1.0.schema.json asks.

/** A 1944-D Washington quarter, read plainly: every field the schema requires. */
export function quarterAnswer(): Record<string, unknown> {
  return {
    kind: 'coin',
    country: 'US',
    countryName: 'United States',
    currency: 'USD',
    denomination: 'quarter dollar',
    faceValue: 0.25,
    year: 1944,
    yearRange: null,
    mintMark: 'D',
    series: 'Washington quarter',
    design: 'Washington portrait on the front, an eagle with spread wings on the back',
    material: '90% silver, 10% copper',
    diameterMm: 24.3,
    inscription: 'LIBERTY IN GOD WE TRUST 1944 UNITED STATES OF AMERICA E PLURIBUS UNUM QUARTER DOLLAR',
    gradeGuess: 'AU',
    gradeNotes: 'Light wear on the high points of the hair. Most of the lustre is still there.',
    notableFeatures: [],
    confidence: 'high',
    unreadable: null,
    funFact: 'Until 1964 this quarter was made of silver, which is why many are still saved.',
  };
}

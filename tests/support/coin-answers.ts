// Sample answers of the coin-from-photos grind, shaped as schemas/coin-from-photos-answer-1.1.schema.json asks.

/** A 1944-D Washington quarter, read plainly: every field the schema requires. */
export function quarterAnswer(): Record<string, unknown> {
  return {
    kind: 'coin',
    subtype: '',
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

/** The same quarter as a 1.0 answer, which has no subtype: the app still accepts it. */
export function quarterAnswer10(): Record<string, unknown> {
  const answer = quarterAnswer();
  delete answer.subtype;
  return answer;
}

/** A New York subway token, read as an Other: its name in `denomination`, no value, no year. */
export function tokenAnswer(): Record<string, unknown> {
  return {
    ...quarterAnswer(),
    kind: 'other',
    subtype: 'Subway token',
    currency: null,
    denomination: 'NYC Transit token',
    faceValue: null,
    year: null,
    mintMark: null,
    series: 'New York City subway tokens',
    design: 'A small brass token with a Y cut out of the middle and the letters NYC around it',
    material: 'brass',
    diameterMm: null,
    inscription: 'NYC TRANSIT AUTHORITY GOOD FOR ONE FARE',
    gradeGuess: null,
    gradeNotes: '',
    confidence: 'medium',
    funFact: 'The cut-out Y let the turnstile tell a real token from a coin.',
  };
}

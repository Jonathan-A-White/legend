Feature: Bulk add: many fronts in one photo, then many backs in one
  He lays several coins out, photographs the fronts once, turns each coin over where it lies and photographs the backs once.
  The app pairs each front to the back that lies where it lay, and says so whenever it is unsure; a wrong pair is never saved
  unasked. The pairing works on the coins' circles alone.

  Scenario: fronts are paired to the backs that lie where they lay, and an unsure pair is flagged, never re-paired silently
    Given 12 fronts and the same 12 backs, each moved a little where it lay
    When the fronts are paired to the backs
    Then every front is paired to its own back and no pair is flagged
    And a back much smaller than its front is flagged as smaller
    And two crowded coins whose backs are swapped in position are both flagged as close to another coin

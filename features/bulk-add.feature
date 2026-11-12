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

  Scenario: the fronts are photographed once and the coins found are outlined and numbered
    Given Add many at once is open on Fronts with the camera
    When he photographs twelve coins laid out four across and three down
    Then the line says 12 coins found and the twelve outlines are numbered 1 to 12
    And Retake and Next are offered

  Scenario: Next turns to a card that asks him to flip the coins, and Backs shows the fronts' rings
    Given the fronts were photographed with twelve coins found
    When he taps Next
    Then the Flip card asks him to turn each coin over where it lies, without a camera
    And tapping Backs shows the Backs viewfinder with twelve numbered ghost rings

  Scenario: a batch with fewer backs than fronts offers only Retake
    Given the backs step is open after twelve fronts
    When he photographs eleven coins
    Then the line says 12 fronts but 11 backs
    And only Retake is offered and there is no way to continue

  Scenario: a batch with as many backs as fronts goes on to the Review stub, which stores nothing
    Given the backs step is open after twelve fronts
    When he photographs twelve coins
    Then the line says 12 coins found and Next is offered
    And Next opens a Review that says 12 coins and nothing has been stored

  Scenario: coins that touch are not gone on with
    Given Add many at once is open on Fronts with the camera
    When he photographs twelve coins of which two touch
    Then the line says Two coins touch: move them apart
    And only Retake is offered and there is no way to continue

  Scenario: coins too small to read a date are refused, and small ones carry a warning
    Given Add many at once is open on Fronts with the camera
    When he photographs coins under 500 px across
    Then the line says Too small to read a date and only Retake is offered
    And a photo of coins 560 px across says Coins look small and still offers Next

  Scenario: a photo from the gallery is read the same way
    Given Add many at once is open on Fronts with the camera
    When he chooses a gallery photo of twelve coins
    Then the line says 12 coins found and the twelve outlines are numbered 1 to 12

  Scenario: the camera is asked for the sensor's size and let go when the screen closes
    Given Add many at once is open on Fronts with the camera
    When he taps Close
    Then the camera was asked for 4096 by 3072 and has been let go
    And he is back on the Collection

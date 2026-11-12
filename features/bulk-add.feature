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

  Scenario: a batch with as many backs as fronts goes on to the Review, which stores nothing
    Given the backs step is open after twelve fronts
    When he photographs twelve coins
    Then the line says 12 coins found and Next is offered
    And Next opens a Review that says 12 coins to save and nothing has been stored

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

  Scenario: an amber pair keeps Save disabled until he says it looks right
    Given the Review is open with twelve pairs of which the back of coin 6 is smaller than its front
    Then Save says Check 1 first and is disabled, and the amber pair is listed first with its reason
    When he taps Looks right on coin 6
    Then the pair is plain, the top line no longer says there is one to check, and Save says Save 12 coins

  Scenario: Swap then another pair's back trades the two backs, and Undo restores them
    Given the Review is open with twelve pairs of which the backs of coins 6 and 7 are of each other's size
    Then Save says Check 2 first and is disabled
    When he taps Swap on coin 6 and then the back of coin 7
    Then the two backs have traded places, both pairs are plain and Save says Save 12 coins
    When he taps Undo
    Then the backs are where they were and Save says Check 2 first again

  Scenario: Leave out drops the pair and Save stores the rest as the item Add makes
    Given the Review is open with twelve pairs and the factory is listening
    When he leaves out coin 4 and taps Save 11 coins
    Then the top line read 11 coins to save before he saved
    And he is on the Collection told 11 coins saved and the factory is reading them
    And the items table holds 11 pending coins, each with its own front and back cut-outs as photos
    And the factory is sent the 11 coins once each, in order

  Scenario: a swap is saved as he made it
    Given the Review is open with twelve pairs of which the backs of coins 6 and 7 are of each other's size
    When he swaps the backs of coins 6 and 7 and taps Save 12 coins
    Then coin 6 was saved with the back that lay at coin 7 and coin 7 with the one that lay at coin 6

  Scenario: in a coin folder opened with the folder address every coin saved is in that folder
    Given a coin folder and the Review opened from it with twelve pairs
    When he taps Save 12 coins
    Then he is back in the folder and all 12 coins are in it

  Scenario: Close on the Review asks before leaving and stores nothing
    Given the Review is open with twelve pairs
    When he taps Close
    Then he is asked Leave without saving and can Stay
    And Leave takes him to the Collection with nothing stored

  Scenario: Retake the backs and Start over go back a step
    Given the Review is open with twelve pairs
    When he taps Retake the backs
    Then the Backs viewfinder is open again with twelve ghost rings
    And from a new Review Start over opens Fronts with no photo kept

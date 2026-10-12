Feature: Rarity
  An item view of a US cent, nickel, dime or quarter says in one line how rare the coin is: a word, how many the Mint struck,
  and whether it is a key date. Why opens what the number does and does not tell, where the year sits among its series, and the
  key date's reason. A coin the tables cannot place says why in plain words. Nothing leaves the phone.

  Scenario: A state quarter is very common
    Given a Delaware state quarter from 1999 with mint mark P
    When he opens the coin
    Then the rarity line reads "Very common · 373,400,000 struck at Philadelphia in 1999 (Delaware)"
    When he taps why on the rarity line
    Then why says that Legend's word is about how many the Mint made
    And why says where it sits among the Philadelphia Washington quarters

  Scenario: A 1932-D quarter is scarce and a key date
    Given a 1932 Washington quarter with mint mark D
    When he opens the coin
    Then the rarity line reads "Scarce · 436,800 struck at Denver in 1932 · a key date"
    When he taps why on the rarity line
    Then why says it is the fewest of the Denver years
    And why gives the key date's reason
    And why draws a strip of bars with a bar marked as this coin

  Scenario: A coin with no year says so
    Given a Washington quarter with no year
    When he opens the coin
    Then the rarity line reads "Not known: the year is not known"
    And an Edit button is next to it

  Scenario: A Canadian dime is not in the tables yet
    Given a Canadian dime from 1955
    When he opens the coin
    Then the rarity line reads "Not in Legend's tables yet"
    And the line offers a How rare is it? button

  Scenario: The tutor's estimate on a tap
    Given a Canadian dime from 1955
    And the tutor will answer common, 12,000,000 struck as an estimate, medium
    When he opens the coin
    And he taps How rare is it?
    Then the rarity line reads "Common · about 12,000,000 struck, the tutor's estimate"
    And one coin-rarity grist was sent
    When he taps why on the rarity line
    Then why shows the tutor's reason and that it is an estimate
    When he opens the coin again
    Then the estimate is there without a tap
    And the line offers no button

  Scenario: A low-confidence answer is Not known for sure
    Given a Canadian dime from 1955
    And the tutor will answer unknown, no number, low
    When he opens the coin
    And he taps How rare is it?
    Then the rarity line reads "Not known for sure · I cannot place this piece."

  Scenario: Editing the year asks again
    Given a Canadian dime from 1955
    And the tutor will answer common, 12,000,000 struck as an estimate, medium
    When he opens the coin
    And he taps How rare is it?
    Then the rarity line reads "Common · about 12,000,000 struck, the tutor's estimate"
    When the year is edited to 1956
    Then the line offers a How rare is it? button

  Scenario: A failed ask can be tried again
    Given a Canadian dime from 1955
    And the tutor will not answer
    When he opens the coin
    And he taps How rare is it?
    Then the rarity line reads "Could not ask just now"
    And the line offers a How rare is it? button

  Scenario: The line says Asking while the tutor works
    Given a Canadian dime from 1955
    And the tutor takes a long time
    When he opens the coin
    And he taps How rare is it?
    Then the rarity line reads "Asking…"

  Scenario: Offline the tap waits
    Given a Canadian dime from 1955
    And the phone is offline
    When he opens the coin
    Then the How rare is it? button is disabled and says when online

  Scenario: A banknote the tables do not cover can be asked about
    Given a Canadian one dollar note from 1935
    When he opens the coin
    Then the line offers a How rare is it? button

  Scenario: A quarter the tables cover never shows the tap
    Given a 1932 Washington quarter with mint mark D
    When he opens the coin
    Then the rarity line reads "Scarce · 436,800 struck at Denver in 1932 · a key date"
    And the line offers no button

  Scenario: An Other piece has no rarity line
    Given a subway token of the kind Other
    When he opens the coin
    Then there is no rarity line

  Scenario: A coin still at the photo reader has no rarity line
    Given a 1932 Washington quarter with mint mark D that is still pending
    When he opens the coin
    Then there is no rarity line

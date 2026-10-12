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

  Scenario: An Other piece has no rarity line
    Given a subway token of the kind Other
    When he opens the coin
    Then there is no rarity line

  Scenario: A coin still at the photo reader has no rarity line
    Given a 1932 Washington quarter with mint mark D that is still pending
    When he opens the coin
    Then there is no rarity line

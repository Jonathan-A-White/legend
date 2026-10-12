Feature: The globe
  A globe he can turn with one finger, lit where his coins and notes come from. A tap on a country opens what he has from
  it, with the money it uses now and used before; the countries he has nothing from yet are one tap away.

  Scenario: countries with items are lit and the others are not
    Given he has 2 coins from Germany and 1 from the United States
    And the globe is open
    Then the globe is lit for Germany and the United States and not for Japan
    And Germany, with the most, is drawn in the full accent, the United States fainter and Japan as plain land

  Scenario: a tap on a lit country opens its sheet with his items and the country's money now and before
    Given he has 2 coins from Germany and 1 from the United States
    And the globe is open
    When he taps the middle of the globe
    Then the sheet for Germany opens
    And it says You have 2 from here, with a picture of each
    And the money there now is the Euro
    And before it came the Deutsche Mark of 1948 to 2001 and then the Reichsmark of 1924 to 1948
    When he taps one of his coins
    Then that coin opens

  Scenario: a tap on an unlit country shows Not yet with its money
    Given he has 2 coins from Germany and 1 from the United States
    And the globe is open
    When he searches for Japan
    And the globe has stopped turning
    And he taps the middle of the globe
    Then the sheet for Japan opens
    And it says Not yet
    And the money there now is the Yen, and before it the Old Yen until 1950

  Scenario: An Other piece lights its country
    Given he has a Subway token from Japan with no currency, and another Other piece with no country
    And the globe is open
    Then the globe is lit for Japan alone, with one piece
    When he taps Not yet
    Then Japan is not in the list
    When the sheet for Japan is open
    Then it says You have 1 from here, with the piece under the name Subway token and the Other glyph
    And no word on it is undefined and the money block is only the country's own
    When the sheet for the United States is open
    Then it says Not yet, since a piece with no country is on no country

  Scenario: search spins to Japan
    Given he has 2 coins from Germany and 1 from the United States
    And the globe is open
    When he types Jap in the search and picks Japan
    Then the globe is still on its way a moment later
    And the globe has stopped turning
    And Japan faces him, outlined

  Scenario: Not yet lists the countries he lacks by continent
    Given he has 1 coin from Germany
    And the globe is open
    When he taps Not yet
    Then the list has Asia with Japan and North America with the United States
    And Germany is not in the list
    And the globe rests behind the list, drawing nothing
    When he taps Japan in the list
    Then the sheet for Japan opens

  Scenario: the loop stops when the page hides
    Given he has 2 coins from Germany and 1 from the United States
    And the globe is open
    When the globe is left untouched for 10 seconds
    Then it spins slowly on its own
    When the page hides
    Then no frame is asked for and nothing more is drawn
    When the page shows again
    Then it draws once and waits for him

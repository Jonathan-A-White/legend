Feature: The Collection
  Everything he has collected, to look through and search: a count line, a grid of photographs, filters, and one item opened large with its facts, notes, and Remove.

  Scenario: the count line counts coins, bills and countries
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    Then the count line reads "3 coins · 1 bill · 3 countries"

  Scenario: search narrows the grid as he types
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he types "dime" in the search box
    Then the grid shows only the Canada dime
    And the count line reads "1 coin · 1 country"

  Scenario: Coins hides bills and a country chip narrows to that country
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he taps the Coins chip
    Then the grid shows no bill
    When he picks Canada in the country list
    Then the grid shows only the Canada dime

  Scenario: a pending item shows At the factory
    Given a collection with one pending item
    When the Collection opens
    Then its thumbnail says "At the factory"

  Scenario: the Item view shows both photos and every fact and a note is saved as typed
    Given a collection of 3 coins and 1 bill from 3 countries
    When he opens the United States quarter
    Then both photos are shown
    And the facts are shown: country, denomination, year, mint, series, design, grade guess marked as a guess, the inscription and the fun fact
    When he types a note "Found in a jar"
    Then the note is saved on the item as "Found in a jar"

  Scenario: Remove needs a hold and can be undone within five seconds
    Given a collection of 3 coins and 1 bill from 3 countries
    When he opens the United States quarter
    And he taps Remove
    Then the item is still in the collection
    When he holds Remove
    Then the item is removed and Undo is offered
    When he taps Undo
    Then the item is back in the collection
    When he holds Remove again
    And five seconds pass
    Then the item stays removed and Undo is gone

  Scenario: Back closes the item view
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he opens the United States quarter
    And he presses Back
    Then the Collection is showing

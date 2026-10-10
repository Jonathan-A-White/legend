Feature: The Quarters album shows the quarters he has on a map of the United States
  The Quarters screen lights each state by how many of its quarter designs he has, lists a state's quarters by programme with a
  tick for each one he owns, counts what he has in each programme and lists every design in order. His items are matched to
  designs from what they say (country, denomination, year, series and design), never by hand-filling a table.

  Scenario: A state with all its designs is lit, with some is half-lit, with none is grey
    Given Delaware has both its quarters in the collection and Ohio only its 2002 one
    When the Quarters screen opens
    Then Delaware is lit
    And Ohio is half-lit
    And Texas is grey

  Scenario: Tapping Ohio shows its 2002 state quarter and its 2013 Perry's Victory quarter with ticks for the ones he has
    Given Delaware has both its quarters in the collection and Ohio only its 2002 one
    When the Quarters screen opens
    And they tap Ohio
    Then the sheet lists the 2002 Ohio state quarter with a tick
    And the sheet lists the 2013 Perry's Victory quarter without a tick
    And the sheet says Missing: 1

  Scenario: The programme picker counts You have N of M
    Given Delaware has both its quarters in the collection and Ohio only its 2002 one
    When the Quarters screen opens
    Then the picker offers All, 50 States, Territories, America the Beautiful, Crossing the Delaware, American Women and 2026
    And it says You have 3 of 138
    When they pick America the Beautiful
    Then it says You have 1 of 56
    When they pick 50 States
    Then it says You have 2 of 50

  Scenario: The Checklist lists 138 designs in programme and year order
    Given Delaware has both its quarters in the collection and Ohio only its 2002 one
    When the Quarters screen opens
    And they open the Checklist
    Then it lists 138 designs
    And the first is the 1999 Delaware state quarter with a tick and the last is the 2026 Gettysburg Address quarter
    And the programmes come in order and the years never go back inside one

  Scenario: The territories show as tiles
    Given the collection holds a Puerto Rico quarter from 2009
    When the Quarters screen opens
    Then the territories show as six tiles: DC, PR, GU, AS, VI and MP
    And the Puerto Rico tile is half-lit

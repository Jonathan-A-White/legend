Feature: Learn teaches grading, mint marks and special years on the coins he has
  Learn has four cards: Grading, Mints, Special years and Your path. Each page is drawn from his own items and the reference
  data that ships with the app, so it shows his coins where they belong. Nothing here leaves the phone, and each page ends with
  Ask the tutor, filled in for that page.

  Scenario: The grading ladder shows every Sheldon step and his VF coin sits at VF
    Given his collection holds a quarter he guessed at VF and a cent he guessed at MS-65
    When the Grading page opens
    Then the ladder lists 30 steps from MS-70 at the top to PO-1 at the foot
    And his quarter sits at VF
    And his cent sits at MS-65

  Scenario: Grade one of yours ends in a band and Keep saves the guess
    Given his collection holds a quarter with no grade
    When the Grading page opens
    And they pick the quarter to grade
    And they answer yes to the date, a little to the high points and no to the shine
    Then the walk says VF with Very Fine
    And the walk says That's a guess; the tutor or a dealer can say more
    And the quarter has no grade yet
    When they tap Keep
    Then the quarter is graded VF

  Scenario: Mints shows the eight marks and his D coins under D
    Given his collection holds a 1950 quarter with a D, a 1850 half dime with a D and a 1964 dime with no mark
    When the Mints page opens
    Then it shows eight mint marks
    And the 1950 quarter is under D for Denver
    And the 1850 half dime is under D for Dahlonega
    And the dime with no mark is under no mint

  Scenario: Special years badges a 1955 Lincoln cent he has and shows Keep an eye out for 1909-S VDB
    Given his collection holds a 1955 Lincoln cent
    When the Special years page opens
    Then 1955 doubled die says You have one!
    And 1909-S VDB says Keep an eye out

  Scenario: Special years shows how many were struck
    When the Special years page opens
    Then 1909-S VDB says 484,000 struck
    And 1950-D says 2,630,030 struck
    And 1955 doubled die shows no number struck

  Scenario: Your path shows each skill's level and next step from his items
    Given his collection holds three graded coins from two countries and he has asked the tutor once
    When the Your path page opens
    Then Grading is at level 1 of 3 and says Grade two more coins to reach the next level
    And World is at level 1 of 4 and says Add coins from three more countries to reach the next level
    And Tutor is at level 1 of 3
    And the Since you started row has a bar for the month of his first item

  Scenario: Each page ends with Ask the tutor
    When each Learn page opens
    Then every page ends with Ask the tutor filled in for that page

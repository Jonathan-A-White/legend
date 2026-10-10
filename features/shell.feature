Feature: The shell
  Legend opens on a bottom bar with its five screens, so the collector always knows where they are and how to move.

  Scenario: The bottom bar shows Collection, Globe, Quarters, Learn and Settings and the tapped one is active
    Given Legend is open on the Collection
    Then the bottom bar shows Collection, Globe, Quarters, Learn and Settings
    And Collection is the active one
    When they tap Globe
    Then Globe is the active one
    And the Globe screen says what will be there

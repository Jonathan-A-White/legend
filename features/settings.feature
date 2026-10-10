Feature: Settings
  Every setting is declared once in the registry; the Settings screen draws whatever is declared, and the tutor may change those marked for it.

  Scenario: Every registered row is drawn in its section
    Given the Settings screen is open
    Then every registered row is drawn in its section

  Scenario: Changing a row writes the setting and the change is announced on the bus
    Given the Settings screen is open
    And something is listening to settings changes on the bus
    When they choose Dark for Theme
    Then the theme setting is saved as dark
    And the bus was told that theme changed from system to dark

  Scenario: A talkable setting is marked so the tutor may change it
    Given the Settings screen is open
    Then the Theme row is marked as one the tutor may change
    And the Sharing row is not
    When the tutor asks to change both
    Then only the theme is changed

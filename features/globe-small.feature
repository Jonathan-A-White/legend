Feature: The smallest countries are on the globe
  The world file has the micro-states and the small island countries as well as the big ones: each can be found by name,
  and a tap at or near it opens it. Tiny ones are drawn as a dot, so a finger can see what it is aiming at.

  Scenario: the smallest countries are found by name
    Given the globe is open on the real world file
    Then searching finds Singapore, Vatican City, Monaco, Malta, Andorra, Liechtenstein and San Marino

  Scenario: a tap at or beside Singapore opens it
    Given the globe is open on the real world file
    When he turns the globe to Singapore
    And he taps on the dot for Singapore
    Then the sheet for Singapore opens

  Scenario: a tap a few pixels from Singapore's dot opens it too
    Given the globe is open on the real world file
    When he turns the globe to Singapore
    And he taps about 7 pixels from the dot for Singapore
    Then the sheet for Singapore opens

  Scenario: the globe tip tells him to pinch to zoom
    Given the globe is open on the real world file
    Then the globe tip says to drag to turn, pinch to zoom and tap a lit country

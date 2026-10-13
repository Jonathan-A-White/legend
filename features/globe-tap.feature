Feature: Tapping a small country and zooming the globe
  A tap lands within a finger's width of a small country and still picks it; a tap among several tiny ones offers a short
  list of their names; two fingers zoom the globe in and out, within bounds, and a tap still picks at any zoom.

  Scenario: a tap beside a small country opens it
    Given the globe is open on a world of tiny countries
    When he turns the globe to Luxembourg
    And he taps beside Luxembourg, in the sea about 14 pixels from it
    Then the sheet for Luxembourg opens

  Scenario: a tap far from every country opens nothing
    Given the globe is open on a world of tiny countries
    When he turns the globe to Luxembourg
    And he taps in the sea about 60 pixels from Luxembourg
    Then no sheet opens and no list appears

  Scenario: a tap among several tiny islands offers a short list of them
    Given the globe is open on a world of tiny countries
    When he turns the globe to Dominica
    And he taps in the sea beside Dominica, between the islands
    Then a list of the islands near his tap appears: Dominica, Saint Lucia and Barbados
    When a moment passes
    And he taps Saint Lucia in the list
    Then the sheet for Saint Lucia opens

  Scenario: the tap that opened the list does not also choose from it
    Given the globe is open on a world of tiny countries
    When he turns the globe to Dominica
    And he taps in the sea beside Dominica, between the islands
    And the phone sends that same tap on as a click on the list
    Then the list is still there and no sheet opened

  Scenario: a tap elsewhere on the globe puts the list away
    Given the globe is open on a world of tiny countries
    When he turns the globe to Dominica
    And he taps in the sea beside Dominica, between the islands
    And he touches the globe again
    Then the list is gone

  Scenario: two fingers zoom the globe in and out within bounds
    Given the globe is open on a world of tiny countries
    When he spreads two fingers apart on the globe
    Then the globe is zoomed in, by about the spread
    When he pinches the two fingers together
    Then the globe is back at its full view
    When he spreads two fingers far apart
    Then the globe is zoomed in no further than 6 times
    When he lifts one finger and drags the other
    Then the zoom holds
    When he lifts his fingers
    Then the globe rests and did not open a country

  Scenario: a tap still picks a country when the globe is zoomed
    Given the globe is open on a world of tiny countries
    When he turns the globe to Luxembourg
    And he spreads two fingers apart on the globe
    And he lifts his fingers
    And he taps beside Luxembourg, in the sea about 14 pixels from it
    Then the sheet for Luxembourg opens

Feature: Worth
  The factory gives each named item a rough range in dollars, from what Legend knows of it and its grade guess. It is kept with a date
  and asked again after 30 days or when the grade guess or the year changes. It is shown as an estimate for learning, never a price,
  and a setting hides it.

  Scenario: a confirmed item asks for a value once and shows About low to high with rough estimate
    Given a confirmed 1964 quarter and a factory that values it at 1 to 3 dollars
    When he opens the quarter
    Then one item-value grist was sent with the quarter's facts
    And the quarter says "About $1 to $3 · rough estimate"
    And why opens the basis the factory gave

  Scenario: a second open within 30 days asks nothing
    Given a confirmed 1964 quarter valued 3 days ago at 1 to 3 dollars
    When he opens the quarter
    Then the quarter says "About $1 to $3 · rough estimate"
    And nothing was sent to the factory

  Scenario: a changed grade guess asks again
    Given a confirmed 1964 quarter valued at 1 to 3 dollars for a VF guess and a factory that values it at 4 to 6 dollars
    When he opens the quarter
    And he changes the grade guess to XF
    Then a second item-value grist was sent and the quarter says "About $4 to $6 · rough estimate"

  Scenario: the Collection sums the ranges
    Given two confirmed quarters valued at 1 to 3 and 2 to 5 dollars and a coin he is only looking at valued at 10 to 20
    When the Collection opens
    Then it says "Rough worth: about $3 to $8"
    When he taps the Rough worth line
    Then it explains in two sentences that this is an estimate for learning, not a price

  Scenario: Show values off hides both lines
    Given a confirmed 1964 quarter valued 3 days ago at 1 to 3 dollars
    And the Show values setting is off
    When he opens the quarter
    Then the quarter shows no worth line
    When the Collection opens
    Then the Collection shows no Rough worth line

  Scenario: a pending item asks nothing
    Given a pending coin and a factory that would value anything
    When the Collection opens
    Then nothing was sent to the factory

  Scenario: a Just looking item shows About low to high and Is it a good one? on its Confirm sheet
    Given a coin he is only looking at, named as a VF 1964 quarter, and a factory that values it at 1 to 3 dollars
    When he opens it and taps Check it
    Then the Confirm sheet says "About $1 to $3 · rough estimate"
    And under Is it a good one? it shows the VF grade guess and the wear notes

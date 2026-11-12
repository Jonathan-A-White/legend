Feature: The photo reader's answer is checked before anything is kept
  A photo of a coin or a banknote goes to the factory's grind and comes back as an answer. Legend validates that answer
  against its own schema before it touches the collection, so a strange answer is refused, never stored.

  Scenario: A good answer for a quarter is read and mapped
    Given the photo reader answers for a 1944 Washington quarter struck at Denver
    When Legend reads the answer
    Then it is accepted with country US, denomination quarter dollar, year 1944 and mint mark D

  Scenario: An answer with an extra key is refused
    Given the photo reader answers with an extra key
    When Legend reads the answer
    Then it is refused and nothing is kept

  Scenario: A banknote's serial number is never accepted
    Given the photo reader answers for a banknote with a serial number field
    When Legend reads the answer
    Then it is refused and nothing is kept

  Scenario: A worn date is a range and the answer is only low confidence
    Given the photo reader answers with a year range and no year but medium confidence
    When Legend reads the answer
    Then it is accepted with year null and confidence low

  Scenario: A backwards year range is refused
    Given the photo reader answers with a year range that runs backwards
    When Legend reads the answer
    Then it is refused and nothing is kept

  Scenario: The Confirm sheet warns when the reader says the back belongs to a different coin
    Given a named coin whose answer said the two sides do not agree
    When he opens the Confirm sheet
    Then it says "The back may belong to a different coin" with the buttons Retake the back and That's right

  Scenario: The Confirm sheet says nothing when the reader says the two sides agree
    Given a named coin whose answer said the two sides agree
    When he opens the Confirm sheet
    Then it has no warning about the back and shows the usual That's right

  Scenario: The Confirm sheet says nothing when the reader could not tell
    Given a named coin whose answer said it could not tell whether the sides agree
    When he opens the Confirm sheet
    Then it has no warning about the back and shows the usual That's right

  Scenario: The Confirm sheet says nothing for a coin read before the check existed
    Given a named coin read before the reader checked the sides
    When he opens the Confirm sheet
    Then it has no warning about the back and shows the usual That's right

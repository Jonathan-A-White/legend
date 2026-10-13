Feature: The tutor
  On one of his items and on a country's sheet, 'Ask the tutor' opens the Ask box: a field, Ask, and three suggested questions
  for that screen. A question goes to the mill as one grist of the kind legend-ask, carrying what the screen knows: the item's
  facts and its photos, or the country and a count of his collection, and the settings the tutor may change. The answer shows
  under the box, is kept and is there again when he comes back. Its follow-ups are buttons that ask at once. A setting the tutor
  suggests changes only when he taps Apply, and Undo puts it back. The scenarios run against a fake Postern and its mill.

  Scenario: an item question goes out with the item's facts, its two photos and the talkable settings
    Given Legend is open on his 1964-D quarter with two photos behind a fake Postern
    When he taps "Ask the tutor"
    And he taps the suggested question "How do I grade this one?"
    Then the mill received one legend-ask grist for the legend app
    And the grist asks "How do I grade this one?" on the item screen
    And the grist names the quarter's facts and none of his notes or tags
    And the grist carries the two photos, obverse then reverse
    And the grist carries every talkable setting and no other
    And the grist fits the legend-ask input schema

  Scenario: Ask the tutor about a token
    On an Other piece the tutor is told its kind and its subtype, and the questions offered are about the piece itself.
    Given Legend is open on his subway token behind a fake Postern
    When he taps "Ask the tutor"
    Then the sheet is named for the Subway token
    And the suggested questions are about the token, not about grading or mint marks
    When he taps the suggested question "What was this subway token used for?"
    Then the mill received one legend-ask grist for the legend app
    And the grist names the token's kind other and its subtype
    And the grist fits the legend-ask input schema

  Scenario: The tutor is told how rare it is
    The rarity line the item shows goes to the tutor as a fact, so "How rare is it?" is answered from the real number. A coin the
    tables do not place, and an Other piece, go with nothing: the tutor then says it does not have the figure.
    Given Legend is open on his 1932-D quarter behind a fake Postern
    When he taps "Ask the tutor"
    And he taps the suggested question "How rare is it?"
    Then the mill received one legend-ask grist for the legend app
    And the grist says the quarter's rarity with 436,800 and the number 436800
    And the grist fits the legend-ask input schema
    When he asks about a quarter with no year
    Then the grist says no rarity and no number
    When he asks about his subway token
    Then the token's grist says no rarity and no number

  Scenario: a country question goes out with the country and the collection summary and no photos
    Given Legend is open on Japan's sheet behind a fake Postern, with two US coins and one Japanese note
    When he taps "Ask the tutor"
    And he taps the suggested question "What money did they use before?"
    Then the mill received one legend-ask grist for the legend app
    And the grist names Japan and no item
    And the grist counts his collection by country and kind, with others counted apart
    And the grist carries no photo
    And the grist fits the legend-ask input schema

  Scenario: the answer shows under the box and is kept on return
    Given Legend is open on his 1964-D quarter with two photos behind a fake Postern
    When he taps "Ask the tutor"
    And he types "How worn is it?" and taps Ask
    Then the box says "Waiting for the tutor…"
    When the tutor answers "Look at **the hair above the ear**: on yours it is worn smooth."
    Then the answer shows under the box with "the hair above the ear" in bold
    And the question "How worn is it?" is kept with its answer
    When he goes back to the Collection and opens the quarter's Ask box again
    Then the answer is there again under the box

  Scenario: follow-ups are tappable and send
    Given Legend is open on his 1964-D quarter with two photos behind a fake Postern
    And the tutor will answer with the follow-ups "What is a key date?" and "Why did silver stop in 1965?"
    When he taps "Ask the tutor"
    And he types "Is this one rare?" and taps Ask
    Then the follow-ups show as buttons under the answer
    When he taps the follow-up "What is a key date?"
    Then a second grist asks "What is a key date?"
    And the second grist carries the first question and its answer as history

  Scenario: a settings change is applied only on Apply and can be undone
    Given Legend is open on his 1964-D quarter with two photos behind a fake Postern
    And the tutor will suggest Text size large because "Bigger words are easier on the eyes." and Sharing off
    When he taps "Ask the tutor"
    And he types "The words are too small" and taps Ask
    Then a card says "The tutor suggests: Text size large. Why: Bigger words are easier on the eyes."
    And no card suggests Sharing, which only he can change
    And Text size is still normal
    When he taps Apply
    Then Text size is large and the bus heard the change
    When he taps Undo
    Then Text size is normal again

  Scenario: a failure says so in words
    Given Legend is open on his 1964-D quarter with two photos behind a fake Postern
    And Postern cannot be reached
    When he taps "Ask the tutor"
    And he types "Where is the mint mark?" and taps Ask
    Then the box says "Could not reach the tutor" and "Postern did not answer. Check the connection and try again."
    And his question is back in the field with Try again
    And nothing is kept as answered

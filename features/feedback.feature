Feature: Tell the maker
  From Settings ('Tell the maker') and from the small '…' on the Collection, Globe, Quarters and Learn bars he opens one sheet with
  two big entries, 'Can I add this?' and 'Something's wrong', a box for his words and Send. Send queues one grist of the kind
  feedback in the outbox and sends it with the phone's key when the phone is online. The grist carries the screen he was on, his
  words, which of the two it is and the app's version; no photo unless he attaches one screenshot. The scenarios run against a
  fake Postern whose mill answers a feedback grist with {"status":"sent"}.

  Scenario: Can I add this? sends a feedback grist with the screen and the words and the version
    Given Legend is open on the Collection behind a fake Postern
    When he opens the feedback sheet from the bar
    And he picks "Can I add this?" and writes "Please add a place for notes about where I found a coin"
    And he taps Send
    Then the mill received one feedback grist for the legend app
    And the grist says kind "add", screen "Collection", his words and the app's version
    And the grist carries only fields the feedback input schema allows
    And the grist carries no photo

  Scenario: Offline, the feedback waits in the outbox and goes when online
    Given Legend is open on the Collection behind a fake Postern
    And the phone is offline
    When he opens the feedback sheet from the bar
    And he writes "The map is slow on my phone"
    And he taps Send
    Then the sheet says it is saved and will go when he is online
    And the outbox holds one feedback and the mill received nothing
    When the phone comes online
    Then the mill received one feedback grist for the legend app
    And the outbox is empty

  Scenario: Something's wrong from the Globe names the globe screen
    Given Legend is open on the Globe behind a fake Postern
    When he opens the feedback sheet from the bar
    And he picks "Something's wrong" and writes "Brazil does not light up"
    And he taps Send
    Then the mill received one feedback grist for the legend app
    And the grist says kind "wrong", screen "Globe", his words and the app's version

  Scenario: A sent feedback thanks him
    Given Legend is open on Settings behind a fake Postern
    When he taps "Tell the maker" in Settings
    And he picks "Can I add this?" and writes "Dark mode by the clock"
    And he taps Send
    Then the sheet says "Sent, thank you: the factory reads these"
    And the bus has heard "feedback.sent" for "add"

  Scenario: Send waits for his words
    Given Legend is open on the Collection behind a fake Postern
    When he opens the feedback sheet from the bar
    Then Send is not available
    And the mill received nothing

  Scenario: A long paste is never cut: the box shows how long it is and Send waits until it is short enough
    Given Legend is open on the Collection behind a fake Postern
    When he opens the feedback sheet from the bar
    And he pastes 1500 characters into the message
    Then the message box still holds all 1500 characters
    And the sheet says "1500 of 1200"
    And Send is not available
    When he cuts the message down to 1100 characters
    Then the sheet no longer says it is too long
    And Send is available

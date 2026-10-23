Feature: Let the tutor do it
  A form never has to be filled in alone. On Tell the maker (and on What is the asking price?) the button 'Let the tutor do it' opens a
  panel where the tutor asks one question at a time and each answer fills the matching field, which he sees filled. The tutor never
  sends: the panel's Send runs the very command the sheet's own Send runs, so the same feedback grist goes. The scenarios run
  against a fake Postern whose mill answers a legend-ask grist when the step says so.

  Scenario: The tutor fills Tell the maker and his tap on Send sends the same feedback as the sheet's Send
    Given Legend is open on the Collection behind a fake Postern
    When he opens the feedback sheet from the bar
    And he taps Let the tutor do it
    Then the mill is asked by the tutor with the form Tell the maker and its three fields
    When the tutor asks "What would you like to tell the maker?" and fills the kind with "Can I add this?"
    Then the kind "Can I add this?" is picked on the sheet
    When he answers and the tutor fills the message with "A place for notes about where I found a coin"
    Then the message box holds "A place for notes about where I found a coin"
    And the mill received no feedback grist
    When he taps the panel's Send
    Then the mill received one feedback grist for the legend app
    And the grist says kind "add", screen "Collection" and his words "A place for notes about where I found a coin"
    And the sheet says "Sent, thank you: the factory reads these"

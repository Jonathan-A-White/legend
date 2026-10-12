Feature: Share
  Private by default: nothing leaves the phone unless he shares it. A picture of his globe or a card of one item goes
  through the phone's share sheet. The card has the photos and the facts, never notes, tags, values or serial numbers.

  Scenario: Share on the globe makes a picture with the lit countries and the caption and offers the share sheet
    Given he has 2 coins from Germany and 1 from the United States
    And his name is Paul
    And the globe is open
    When he taps Share on the globe
    Then the share sheet is offered one JPEG picture of 1080 by 1080
    And the picture shows the lit countries and says Paul's coins come from 2 countries

  Scenario: Share on an item makes a card with both photos and the facts and no notes
    Given he has a quarter with both photos, a note, a tag and a serial number in its series
    And that item is open
    When he taps Share on the item
    Then the share sheet is offered one JPEG picture of 1080 by 1350
    And the card shows both photos and the denomination, year, country, mint, series, design, grade guess and inscription
    And the card shows no note, no tag and no run of eight digits

  Scenario: Sharing an Other piece
    Given he has a Subway token from the United States with a note, a tag and a worth
    And that item is open
    When he taps Share on the item
    Then the share sheet is offered one JPEG picture of 1080 by 1350
    And the card is titled Subway token and shows the country, a Type row and no Mint row
    And the card shows no note, no tag and no worth

  Scenario: An Other piece without navigator.share gets a Save picture link
    Given he has a Subway token from the United States with a note, a tag and a worth
    And the phone has no share sheet
    And that item is open
    When he taps Share on the item
    Then a Save picture link appears for the picture

  Scenario: without navigator.share a Save picture link appears
    Given he has 2 coins from Germany and 1 from the United States
    And the phone has no share sheet
    And the globe is open
    When he taps Share on the globe
    Then a Save picture link appears for the picture

  Scenario: Sharing off hides both buttons
    Given he has a quarter with both photos, a note, a tag and a serial number in its series
    And Sharing is turned off in Settings
    When the globe is open
    Then there is no Share button on the globe
    When that item is open
    Then there is no Share button on the item

  Scenario: The first time, a short line says what leaves the phone
    Given he has 2 coins from Germany and 1 from the United States
    And the globe is open
    Then under Share it says Only this picture leaves the phone.
    When he taps Share on the globe
    Then the line is gone

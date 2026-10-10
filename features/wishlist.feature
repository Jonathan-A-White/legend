Feature: Wish list
  At the store he photographs a coin he cannot buy today, keeps it with its asking price, and saves up for it. A wished coin is
  not in the Collection, its counts or any picture he shares. When he gets it, it moves into the Collection with the price paid.

  Scenario: Wish for it on a Just looking coin asks the price and keeps the coin as wished with its store
    Given a coin he is only looking at, a 1916 Standing Liberty quarter with its photos
    When he opens it, taps Check it and taps Wish for it
    Then the sheet asks for the asking price and will not keep the wish until a price is typed
    When he types 12 as the asking price and Corner Coins as the store and keeps the wish
    Then the coin is wished with an asking price of 12 and the store Corner Coins and still has its photos

  Scenario: the Wish list shows each wished coin with its photo, asking price and rough worth beside it
    Given two wished coins, a 1916 quarter asked 12 at Corner Coins that the factory values at 8 to 15, and a 1932 dime asked 30
    When he opens the Collection and taps Wish list
    Then the Wish list shows the 1916 quarter with its photo, "about $8 to $15 · asked $12" and the store Corner Coins
    And the 1932 dime shows only "asked $30" because it has no rough worth yet

  Scenario: Got it! moves the coin into the Collection with the price paid
    Given a wished coin, a 1916 quarter asked 12, with its photos
    When he opens the Wish list and taps Got it! on the quarter
    Then the sheet asks what he paid with 12 already in it
    When he keeps it as bought
    Then the quarter is in the Collection as confirmed with a price paid of 12 and its photos, and the Wish list is empty

  Scenario: Let it go removes it with undo
    Given a wished coin, a 1916 quarter asked 12, with its photos
    When he opens the Wish list and taps Let it go on the quarter
    Then the Wish list no longer shows the quarter and offers Undo
    When he taps Undo
    Then the quarter is back on the Wish list

  Scenario: Save up for this makes the goal card and Add savings fills the bar
    Given a wished coin, a 1916 quarter asked 12, with its photos
    When he opens the Wish list and taps Save up for this on the quarter
    Then the goal card at the top shows the quarter, its price of $12 and "Saved so far: $0"
    When he taps Add savings and adds 5
    Then the goal card says "Saved so far: $5" with its bar 42 percent full and the savings are kept

  Scenario: reaching the price says You can get it!
    Given a wished coin, a 1916 quarter asked 12, with its photos
    And he is saving up for it and has saved 10
    When he opens the Wish list
    Then the goal card does not say he can get it yet
    When he taps Add savings and adds 2
    Then the goal card says "You can get it!" plainly with its bar full

  Scenario: wished coins are not in the Collection counts and not in any share card
    Given a confirmed 1964 quarter and a wished 1955 Canadian dime
    When the Collection opens
    Then the count line reads "1 coin · 1 country" and the wished coin is not in the grid
    When he opens the wished coin's page
    Then it has no Share button and a share card cannot be made of it

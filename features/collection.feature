Feature: The Collection
  Everything he has collected, to look through and search: a count line, a grid of photographs, filters, and one item opened large with its facts, notes, and Remove. Pieces are also removed from the Collection itself: Select, or a long press on a piece, chooses them.

  Scenario: the count line counts coins, bills and countries
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    Then the count line reads "3 coins · 1 bill · 3 countries"

  Scenario: search narrows the grid as he types
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he types "dime" in the search box
    Then the grid shows only the Canada dime
    And the count line reads "1 coin · 1 country"

  Scenario: Coins hides bills and a country chip narrows to that country
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he taps the Coins chip
    Then the grid shows no bill
    When he picks Canada in the country list
    Then the grid shows only the Canada dime

  Scenario: a pending item shows At the factory
    Given a collection with one pending item
    When the Collection opens
    Then its thumbnail says "At the factory"

  Scenario: the Item view shows both photos and every fact and a note is saved as typed
    Given a collection of 3 coins and 1 bill from 3 countries
    When he opens the United States quarter
    Then both photos are shown
    And the facts are shown: country, denomination, year, mint, series, design, grade guess marked as a guess, the inscription and the fun fact
    When he types a note "Found in a jar"
    Then the note is saved on the item as "Found in a jar"

  Scenario: Remove needs a hold and can be undone within five seconds
    Given a collection of 3 coins and 1 bill from 3 countries
    When he opens the United States quarter
    Then the Remove bar reads "Hold to remove"
    When he taps Remove
    Then the item is still in the collection
    When he holds Remove
    Then the item is removed and Undo is offered
    When he taps Undo
    Then the item is back in the collection
    When he holds Remove again
    And five seconds pass
    Then the item stays removed and Undo is gone

  Scenario: Select on the Collection removes the chosen pieces and Undo puts them back
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he taps Select
    Then the Remove bar reads "Choose pieces to remove"
    When he chooses the United States quarter and the Canada dime
    Then the Collection says "2 chosen" and the Remove bar reads "Hold to remove 2 pieces"
    When he taps Remove
    Then nothing is removed and he is told to hold it
    When he holds Remove
    Then the quarter and the dime are removed, Select is over and Undo is offered
    When he taps Undo
    Then the quarter and the dime are back in the Collection

  Scenario: A long press on a piece starts Select with it chosen, and Undo lasts five seconds
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he long-presses the United States quarter
    Then Select is on with only the quarter chosen and the item view did not open
    When he holds Remove
    And five seconds pass
    Then the quarter stays removed and Undo is gone

  Scenario: Done leaves Select without removing anything
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he taps Select
    And he chooses the United States quarter and the Canada dime
    And he taps Done
    Then the four pieces are links again and none was removed

  Scenario: Back closes the item view
    Given a collection of 3 coins and 1 bill from 3 countries
    When the Collection opens
    And he opens the United States quarter
    And he presses Back
    Then the Collection is showing

  Scenario: An Other piece is counted, filtered and found
    Given a collection of a coin, a bill and an Other piece, a Subway token from the United States
    When the Collection opens
    Then the count line reads "1 coin · 1 bill · 1 other piece · 1 country"
    When he taps the Other chip
    Then the grid shows only the Subway token
    When he taps the All chip
    And he types "subway" in the search box
    Then the Subway token is the only tile
    When he searches for "token" instead
    Then the Subway token is still the only tile
    When he searches for "medal" instead
    Then the grid shows no tile

  Scenario: A replica is found by replica and reads Replica, never as the real piece
    Given a collection of a quarter and a replica of the 1776 Continental dollar, an Other with the subtype "Replica"
    When the Collection opens
    And he types "replica" in the search box
    Then the replica is the only tile and it reads "Replica · Continental dollar"
    When he opens the replica
    Then the item view's title reads "Replica · Continental dollar" and its Subtype row reads "Replica"

  Scenario: Edit makes a piece an Other with a subtype
    Given a collection of 3 coins and 1 bill from 3 countries
    When he opens the Canada dime
    And he edits it to Other with the subtype "Subway token" and clears the denomination
    Then the item view shows "Subway token" as its title and no coin-only rows
    When the app is reloaded
    Then the item view still shows "Subway token" as its title

  Scenario: A folder holds chosen pieces and shows their worth together as one range
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    When he makes a folder "State quarters" on the Collection
    And he puts the quarter and the dime in it from their item views
    And he opens the folder "State quarters"
    Then the folder lists only the quarter and the dime
    And the folder says "2 pieces" and "Rough worth: about $1.25 to $4"
    When he takes the dime out of it from its item view and opens the folder again
    Then the folder lists only the quarter, says "1 piece", and the dime is still in the Collection

  Scenario: A piece in two folders shows in both
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    When he makes a folder "State quarters" on the Collection
    And he makes a folder "Silver" on the Collection
    And he puts the quarter in both folders from its item view
    Then the folder "State quarters" lists the quarter
    And the folder "Silver" lists the quarter

  Scenario: Folders survive a reload and leaving a folder never deletes the piece
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    When he makes a folder "State quarters" on the Collection
    And he puts the quarter in it from its item view
    And the app is reloaded on the Collection
    Then the Collection shows the folder "State quarters" with 1 piece
    When he holds Delete coin folder in the folder "State quarters"
    Then the Collection shows no folder and all three pieces are still in it

  Scenario: A folder can be renamed from its page and the new name shows everywhere
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    When he makes a folder "New folder" on the Collection
    And he puts the quarter in it from its item view
    And he opens the folder "New folder"
    And he taps Rename on its page, types "Coins" and taps Save
    Then the page title, the Collection shelf row and the quarter's Coin folders box all read "Coins" and the quarter is still in it

  Scenario: A folder cannot be renamed to nothing
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    When he makes a folder "New folder" on the Collection
    And he opens the folder "New folder"
    And he taps Rename on its page and clears the name
    Then Save is off, and after Cancel the folder is still called "New folder"

  Scenario: A folder made before the words changed shows as a coin folder with its pieces
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    And a folder "Old album" already stored with the quarter in it
    When he opens the Collection
    Then the Coin folders shelf shows "Old album" with 1 piece and New coin folder
    When he opens the folder "Old album"
    Then the folder lists only the quarter and offers Delete coin folder

  Scenario: The Wish list leads the shelf of folders, and a coin he is only looking at is a small card
    Given a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60
    And a wished 1916 quarter, a 1939 nickel he is only looking at and a coin he is only looking at still at the factory
    When he makes a folder "State quarters" on the Collection
    Then the Wish list, saying "1 piece", is on one shelf with the folder "State quarters" and New coin folder
    And under Looking at the nickel's card reads "Nickel · 1939" and the other card says "At the factory" once, beside its photo

  Scenario: A coin added from a coin folder's camera goes into that folder, and the camera from the Collection puts nothing in a folder
    Given a coin folder "State quarters" that is empty
    When he opens the folder "State quarters" and taps Add a coin
    And he photographs the Front and the Back and taps Name it
    And he closes the camera
    Then he is back on the folder "State quarters" and it lists the new coin, which is also in the Collection
    When he opens the camera from the Collection and photographs a second coin, Front and Back
    Then the second coin is in the Collection and the folder "State quarters" still holds only the first

  Scenario: Backing out of a coin folder's camera adds nothing, and a coin added after its folder is deleted is still saved
    Given a coin folder "State quarters" that is empty
    When he opens the folder "State quarters", taps Add a coin and closes the camera
    Then he is back on the folder "State quarters" and it is still empty
    When he opens the folder's camera again and the folder is deleted before he names the coin
    Then the coin is saved in the Collection and nothing failed

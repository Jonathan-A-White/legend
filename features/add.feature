Feature: Add from the camera, or Just looking
  He photographs a coin or a bill, front and back, and taps Name it. The photos are stored at once and the item waits in a queue
  that sends one after another to the factory, so he can photograph the next one straight away. The factory's answer names the
  item; he confirms it, or lets it go if he was only looking.

  Scenario: two photos are taken, stored under 1 MB each with a thumbnail, and the item is pending before anything is sent
    Given the camera is open on Add and the factory has not answered
    When he takes the Front photo and the Back photo
    And he taps Name it
    Then the item is stored as pending with two photos under 1 MB each and a thumbnail each

  Scenario: a gallery photo is accepted and downscaled
    Given the camera is open on Add and the factory has not answered
    When he chooses a 4000 by 3000 photo from his gallery
    Then the Front photo is kept at 1600 by 1200 under 1 MB with a thumbnail of 320 pixels
    And the prompt now reads Back

  Scenario: the grist is sent with kind coin-from-photos, the device key and the photos in order, and the pending item keeps the txid
    Given the camera is open on Add and the factory has not answered
    When he takes the Front photo and the Back photo
    And he taps Name it
    Then the grist is sent as app legend, kind coin-from-photos, with the device key and the two photos in order
    And the pending item keeps the txid

  Scenario: an answer names the item and the Confirm sheet shows the fields
    Given the camera is open on Add and the factory will name a 1944 Washington quarter
    When he takes the Front photo and the Back photo
    And he taps Name it
    And he opens the named coin to check it
    Then the Confirm sheet shows the country with its flag, denomination, year, mint mark, series, grade marked as a guess, inscription and fun fact
    And the item.named event was published

  Scenario: That's right confirms; Not quite lets him edit a field and then confirms
    Given the camera is open on Add and the factory will name a 1944 Washington quarter
    When he takes the Front photo and the Back photo
    And he taps Name it
    And he opens the named coin to check it
    And he taps That's right
    Then the item is confirmed
    When he photographs a second coin and opens it to check
    And he taps Not quite
    And he changes the year to 1945 and saves
    Then the second item is confirmed with the year 1945 and the first still says 1944

  Scenario: a refusal says why in words and Try again resends
    Given the camera is open on Add and the factory refuses the first photos
    When he takes the Front photo and the Back photo
    And he taps Name it
    Then the item stays pending and says "The factory could not read this one: photograph the back in daylight"
    When he taps Try again
    Then the grist is sent a second time and the item is named

  Scenario: a reopened app resumes waiting on a pending txid
    Given an item that was sent to the factory before the app was closed
    When the app is opened
    Then it waits on the same txid without sending again and the item is named

  Scenario: Name it returns to the viewfinder at once and the item waits in the queue
    Given the camera is open on Add and the factory has not answered
    When he takes the Front photo and the Back photo
    And he taps Name it
    Then the prompt reads Front again and the shutter is ready
    And the queue says "1 at the factory"

  Scenario: a pile of coins never waits on a photo being kept, so it goes photograph, photograph, Name it, next
    Given the camera is open on Add and the phone is slow to keep a photo
    When he taps the shutter twice and Name it without waiting
    Then each tap took at once: the prompt reads Front again, the shutter is ready and the queue says "1 at the factory"
    And nothing is stored until the photos are kept, and then the coin is stored with both and sent

  Scenario: three items queued are sent one after another and each is named
    Given the camera is open on Add and the factory sends one at a time
    When he names three coins in a row
    Then only the first is sent until its send finishes, then the second, then the third
    And all three are named in the order they were queued

  Scenario: a network failure retries and the item stays pending
    Given the camera is open on Add and the first send fails on the network
    When he takes the Front photo and the Back photo
    And he taps Name it
    Then the item stays pending and the send is tried again after a pause and goes through

  Scenario: Just looking names the coin as a considering item that shows under Looking at and not in the counts
    Given a collection of one confirmed coin
    And the camera is open on Add and the factory will name a 1944 Washington quarter
    When he chooses Just looking
    And he takes the Front photo and the Back photo
    And he taps Name it
    And he opens the Collection
    Then the quarter shows under Looking at and the count line still reads "1 coin · 1 country"

  Scenario: Add it confirms it; Let it go removes it with undo
    Given two considering coins that the factory has named
    When he opens the first and taps Add it
    Then the first item is confirmed and no longer under Looking at
    When he opens the second and taps Let it go
    Then the second item is removed and Undo brings it back

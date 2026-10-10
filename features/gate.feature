Feature: The licence gate
  Legend opens on an Unlock screen until this phone's key holds a legend licence on chain. The phone makes its
  key once and shows it with a Copy, so the licence can be issued to it from Postern's Key screen.

  Scenario: A phone with no licence sees Unlock with its public key and Copy
    Given the chain says this phone's key has no licence
    When Legend is opened
    Then he sees the Unlock screen
    And he sees "No licence yet"
    And the Unlock screen shows a device key
    And there is a Copy button
    And the app is not shown
    When he taps Copy
    Then the clipboard holds the device key

  Scenario: A licence held by the issuer opens the app
    Given the issuer minted a licence to this phone's key on a stub chain
    When Legend is opened
    Then he sees the app
    And the Unlock screen is gone

  Scenario: A licence from another issuer does not open the app
    Given someone other than the issuer minted a licence to this phone's key on a stub chain
    When Legend is opened
    Then he sees the Unlock screen
    And he sees "No licence yet"
    And the app is not shown

  Scenario: A revoked licence shows Licence revoked
    Given the issuer minted a licence to this phone's key on a stub chain
    And the issuer then signed a revoke for it
    When Legend is opened
    Then he sees "Licence revoked"
    And the app is not shown

  Scenario: Offline within 24 hours of a held check opens the app
    Given the chain says this phone's key holds a licence
    And Legend is opened
    And he is in the app
    When the phone is offline and Legend is opened again 6 hours later
    Then he sees the app

  Scenario: Offline more than 24 hours after a held check does not open the app
    Given the chain says this phone's key holds a licence
    And Legend is opened
    And he is in the app
    When the phone is offline and Legend is opened again 25 hours later
    Then he sees the Unlock screen
    And he sees "Can't reach the chain"
    And the app is not shown

  Scenario: Check again re-asks the chain
    Given the chain says this phone's key has no licence
    And Legend is opened
    And he sees "No licence yet"
    When the licence is issued and he taps Check again
    Then he sees the app

  Scenario: The key survives a reload
    Given the chain says this phone's key has no licence
    And Legend is opened
    And he notes the device key
    When Legend is opened again
    Then the Unlock screen shows the same device key

  Scenario: A key stored through the test seam is the device key
    Given the private key "0000000000000000000000000000000000000000000000000000000000000001" is stored under "legend.deviceKey" before Legend boots
    When Legend is opened
    Then the Unlock screen shows the public key "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"

  Scenario: The Unlock screen says in plain words what a licence is
    Given the chain says this phone's key has no licence
    When Legend is opened
    Then he sees the words that explain a licence and who issues it

  Scenario: No issuer set keeps the gate shut and says so
    Given no licence issuer is configured
    When Legend is opened
    Then he sees "No licence issuer is set"
    And the app is not shown

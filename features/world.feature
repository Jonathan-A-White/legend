Feature: The world's countries and currencies are on the phone
  The globe and the country sheet need the shapes of the countries, each country's name and flag, and the currencies it has
  had, so the app loads two small files that ship with it and never needs the network for them.

  Scenario: A country is found by its code, with its name and flag
    Given the world files are served
    When Legend loads the countries
    Then the name of DE is Germany and its flag is the German flag
    And a code the map does not know is shown as the code

  Scenario: The countries are fetched once however many screens ask
    Given the world files are served
    When two screens ask for the countries together
    Then the countries file was fetched once

  Scenario: A failed download is tried again next time
    Given the world files cannot be fetched
    When Legend loads the countries and fails
    And the world files are served again
    Then loading the countries now works

  Scenario: Germany's currencies run from the Deutsche Mark to the euro
    Given the world files are served
    When Legend loads the currencies
    Then Germany has the Deutsche Mark ended in 2001 and the euro still current

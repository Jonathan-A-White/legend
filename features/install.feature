Feature: Install Legend on a phone
  Legend installs from the browser like an app, never zooms or scrolls under the collector's thumb,
  takes a new build only when they tap, and says which build is running.

  Scenario: The manifest makes Legend installable
    Given the app is built
    Then the manifest names the app Legend, display standalone, with 192 and 512 maskable icons

  Scenario: The build is served from the root of its own domain
    Given the app is built
    Then every asset of the built page is root-absolute and no GitHub Pages workflow exists

  Scenario: The page cannot be zoomed or scrolled
    Given the document and its root stylesheet
    Then the document forbids pinch zoom and double-tap zoom and the body never scrolls under the app

  Scenario: An update waits for a tap
    Given the service worker registers with the prompt flow
    And a newer build is waiting behind the one in control
    Then the banner says Update
    And nothing is taken yet
    When they tap Update
    Then the waiting build is told to take over

  Scenario: The home screen says which build is running
    Given the home screen is open
    Then the home screen shows the version, build time and commit

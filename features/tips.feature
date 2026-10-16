Feature: One-time tips
  A tip is one quiet line with Got it, shown where it helps and never again once he has tapped Got it. There are three: the camera
  ('Front first, then back, in daylight'), the globe ('Drag to turn, pinch to zoom, tap a lit country') and the tutor ('Ask about the coin in
  front of you'). The list and "dismissed for good" are pwa-kit's tips; the dismissals live in the phone's localStorage. Each tip
  shown and each tap is counted in the usage log by name, never by anything he typed.

  Scenario: The camera tip shows once on first open and never again
    Given a fresh phone
    When the camera opens
    Then the tip "Front first, then back, in daylight" is shown
    When he taps Got it
    Then the tip is gone
    When the camera opens again
    Then no tip is shown
    And the usage log counts "tip.shown:camera" once and "tip.dismissed:camera" once

  Scenario: The globe tip and the tutor tip likewise
    Given a fresh phone
    When the Globe opens
    Then the tip "Drag to turn, pinch to zoom, tap a lit country" is shown
    When he taps Got it on the globe tip
    And the Globe opens again
    Then no tip is shown on the Globe
    When the tutor opens
    Then the tutor tip "Ask about the coin in front of you" is shown
    When he taps Got it on the tutor tip
    And the tutor opens again
    Then no tip is shown for the tutor

  Scenario: A tip stays down after the app is reopened
    Given a fresh phone
    When the camera opens
    And he taps Got it
    And the app is reopened
    And the camera opens again
    Then no tip is shown

  Scenario: The Globe screen shows its tip
    Given a fresh phone
    When the real Globe screen opens
    Then the tip "Drag to turn, pinch to zoom, tap a lit country" is shown

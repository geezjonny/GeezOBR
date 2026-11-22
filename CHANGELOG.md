# Changelog

## 2026-11-22

### Owlbear extension (2.3.8)
- **Cleaner map import:** "New scene" uploads the map with one fog rectangle covering it and nothing else, so old test imports no longer add stray walls or lights.
- **Torch light:** the first light in a dd2vtt file becomes a torch picture prop with a 5 ft soft-edged light for everyone. Other lights use a 10 ft radius.
- **Rolls on tokens:** a roll made in the companion shows above that character's token for a few seconds, with the dice and modifiers (e.g. "Stealth: 17 (12 + 5)") (green for a natural 20, red for a natural 1).
- **Weather:** rain, snow, fog and storm (with wind) drawn over the map on every client, controlled from the GM companion page.

Build a simple, polished **Sudoku web game**.

## Tech Stack

Use a simple modern frontend stack:

* **React**
* **TypeScript**
* **Vite**
* **CSS** for styling
* Use minimal dependencies

Do not add a backend unless absolutely necessary.

Keep the project lightweight and easy to maintain.

---

## First: Make a Plan

Before writing any code, briefly create a practical implementation plan covering:

* Project structure
* Sudoku logic
* Grid-size/difficulty system
* React components
* Responsive UI
* Testing

Then start implementing.

Do not over-engineer the project.

---

## Game

Create a Sudoku game with a simple **difficulty/grid-size slider**.

The slider should allow the player to choose:

* 4×4
* 6×6
* 9×9

Make **9×9 the default**.

Larger grids should provide a more challenging experience.

Generate valid puzzles dynamically for the selected grid size. Every puzzle must have a valid solution.

Include only these core features:

* Grid-size/difficulty slider
* Random puzzle generation
* Cell selection
* Number input
* Delete/clear
* Timer
* New Game
* Win detection

Do not add advanced features such as:

* Hints
* Pencil notes
* Undo/redo
* Accounts
* Leaderboards
* Multiplayer
* Backend
* Cloud saves
* Achievements

Keep the game simple.

---

## UI/UX

Make the interface **minimal, clean, responsive, and easy to play**.

The Sudoku board should be the main focus.

Use:

* Simple typography
* Neutral colors
* Subtle borders
* One restrained accent color
* Clear selected-cell state
* Comfortable spacing
* Simple controls

Avoid:

* Glassmorphism
* Excessive gradients
* Large cards
* Heavy shadows
* Glowing effects
* Decorative graphics
* Unnecessary icons
* Excessive animations
* Dashboard-style UI
* Marketing sections
* AI-generated-looking UI

Do not make the interface look like a generic SaaS template.

The design should feel like a small, thoughtfully designed game.

---

## Responsive Design

The game must work well on both **mobile and desktop**.

### Mobile

* Make the Sudoku board large and easy to tap.
* Provide a simple number pad.
* Use comfortable touch targets.
* Keep controls easy to reach.
* Prevent horizontal scrolling.
* Make the board fit naturally within the available screen width.

### Desktop

* Support mouse input.
* Support keyboard input.
* Number keys should enter numbers.
* Arrow keys should navigate cells.
* Keep the board at a comfortable size.
* Center the game without unnecessarily stretching it on large screens.

Do not simply shrink the desktop layout for mobile. Make the responsive behavior intentional.

---

## Sudoku Interaction

When a cell is selected:

* Clearly highlight the selected cell.
* Subtly highlight its row and column.
* Highlight the relevant box/section where applicable.
* Highlight matching numbers.

Given numbers should look different from player-entered numbers and must not be editable.

Entering a number should require as few interactions as possible.

---

## Difficulty / Grid Size

Use a simple slider or segmented control for selecting the puzzle size/difficulty.

Supported sizes:

* 4×4
* 6×6
* 9×9

9×9 should be selected by default.

Changing the selection should affect the generated puzzle.

Make larger grids progressively more challenging.

Keep the control visually simple and easy to understand.

---

## Completion

When the puzzle is correctly completed:

* Stop the timer.
* Show a simple success message.
* Show the completion time.
* Provide a New Game action.

Keep the completion experience minimal.

---

## Code Quality

Use React components and keep the code organized logically.

Separate the Sudoku logic from the UI where practical.

Use TypeScript properly.

Avoid unnecessary state management libraries.

Avoid unnecessary dependencies.

Do not create unnecessary abstractions.

Every visible control must work.

There should be no console errors or unfinished functionality.

---

## Testing

Before finishing, test:

* 4×4 puzzles
* 6×6 puzzles
* 9×9 puzzles
* Puzzle generation
* Puzzle validation
* Cell selection
* Number input
* Delete
* Timer
* New Game
* Win detection
* Keyboard controls
* Mobile touch interaction
* Responsive layouts

Test at different screen sizes, especially mobile and desktop.

Fix any layout issues before considering the project complete.

---

## Final Goal

Build a **small, polished Sudoku game**, not a feature-heavy application.

Prioritize:

1. Simple gameplay
2. Excellent mobile and desktop usability
3. Reliable Sudoku logic
4. Minimal visual design
5. Clean React/TypeScript code

**Keep it simple. Avoid adding features that aren't necessary for the core Sudoku experience.**

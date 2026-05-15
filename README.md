# Qwixx — MCTS AI

**Play it:** https://harrichael.github.io/Qwixx-mcts/

A browser version of the dice game **Qwixx**, where you play against an AI that uses Monte Carlo Tree Search to pick its moves.

## What is Qwixx?

Qwixx is a fast "roll-and-write" dice game. Each player has a scoresheet with four colored rows:

- **Red** and **Yellow** count up from 2 to 12 (left to right)
- **Green** and **Blue** count down from 12 to 2 (left to right)

On every turn, six dice are rolled: two white dice and one die of each color.

### Each turn has two phases

**1. White phase — _everyone_ plays**
Add the two white dice together. Every player may cross off that number in **any** color row, if they want to.

**2. Color phase — only the active player**
The active player may also pair _one_ white die with _one_ colored die, and cross off that sum in the matching color row.

### The catches

- You can only cross off numbers **left to right** in a row. Skipping numbers is allowed, but you can never go back.
- To cross off the rightmost number in a row, you must have already crossed off **at least 5** numbers in that row. Doing so **locks** the row — it adds a bonus mark and removes that color die from play for everyone.
- If you're the active player and you cross off _nothing_ on your turn, you take a **−5 penalty**.

### Game end

The game ends as soon as either:
- **2 rows** have been locked (by anyone), or
- A player has taken **4 penalties**.

### Scoring

Each row scores by how many marks it has (locked rows count their lock as an extra mark):

| Marks | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|------:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---:|---:|---:|
| Score | 1 | 3 | 6 |10 |15 |21 |28 |36 |45 | 55 | 66 | 78 |

Plus −5 for each penalty. Highest total wins.

## The AI

The AI uses Monte Carlo Tree Search (MCTS): for each decision it simulates thousands of random rollouts of the rest of the game and picks the move with the best average outcome. You can tune the number of simulations and the exploration constant via the ⚙️ menu in-game.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173/Qwixx-mcts/
npm run build    # production build into dist/
npm run deploy   # publish dist/ to the gh-pages branch
```

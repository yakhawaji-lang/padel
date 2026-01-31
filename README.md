# Padel Tournament - King of the Court

A simple frontend application for managing a padel tournament with a "King of the Court" format.

## Features

- **Team Management**: Add/remove teams (default 12 teams)
- **4 Courts**: Divide teams across 4 courts
- **King of the Court**: Winners stay on court until defeated
- **Smart Scheduling**: Ensures no team plays the same opponent twice during group stage
- **3 Matches Per Team**: Each team plays exactly 3 matches in the group stage
- **Scoring System**: Tracks wins, losses, and games won (sets are 6 games)
- **15-Minute Matches**: Timer for each match
- **Standings**: Automatically displays top 4 teams after group stage completion

## How to Run

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## How to Use

1. **Setup Teams**: 
   - Default 12 teams are created automatically
   - Click "+ Add Team" to add more teams
   - Click "−" to remove a team
   - Edit team names by clicking on them

2. **Start Matches**:
   - Click "Assign Teams to Courts" to fill all 4 courts
   - Each match has a 15-minute timer

3. **Record Results**:
   - Enter the number of games won by each team (0-6)
   - Click the winner button to record the match
   - Winner stays on court (King of the Court format)

4. **View Standings**:
   - After all teams complete 3 matches, standings automatically appear
   - Top 4 teams are displayed based on:
     - Wins (primary)
     - Games won (secondary tiebreaker)

## Build for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` folder. You can deploy this folder to any web server or run it on another laptop.


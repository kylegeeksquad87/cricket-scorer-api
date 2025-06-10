// server.js (Create this file in a new backend project directory)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'cricket_app.db');

// --- Database Setup ---
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
    throw err;
  }
  console.log('Connected to the SQLite database.');
  initializeDbSchema();
});

function initializeDbSchema() {
  db.serialize(() => {
    db.run(`PRAGMA foreign_keys = ON;`); // Enable foreign key constraints

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, /* In a real app, store hashed passwords! */
      email TEXT,
      role TEXT NOT NULL,
      profilePictureUrl TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      location TEXT,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      leagueId TEXT NOT NULL,
      captainId TEXT,
      logoUrl TEXT,
      UNIQUE(name, leagueId),
      FOREIGN KEY (leagueId) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (captainId) REFERENCES players(id) ON DELETE SET NULL
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT UNIQUE,
      profilePictureUrl TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS player_teams (
        playerId TEXT NOT NULL,
        teamId TEXT NOT NULL,
        PRIMARY KEY (playerId, teamId),
        FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      leagueId TEXT NOT NULL,
      teamAId TEXT NOT NULL,
      teamBId TEXT NOT NULL,
      dateTime TEXT NOT NULL,
      venue TEXT,
      overs INTEGER DEFAULT 15,
      status TEXT DEFAULT 'Scheduled', /* Scheduled, Live, Completed, Abandoned, Postponed */
      tossWonByTeamId TEXT,
      choseTo TEXT, /* 'Bat' or 'Bowl' */
      umpire1 TEXT,
      umpire2 TEXT,
      result TEXT,
      scorecardId TEXT UNIQUE,
      FOREIGN KEY (leagueId) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (teamAId) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (teamBId) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (scorecardId) REFERENCES scorecards(id) ON DELETE CASCADE 
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS scorecards (
        id TEXT PRIMARY KEY,
        matchId TEXT NOT NULL UNIQUE,
        innings1 TEXT, /* JSON string for Innings object */
        innings2 TEXT, /* JSON string for Innings object */
        FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE
    )`);

    // Seed initial admin user if not exists
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
      if (err) { console.error("Error checking for admin user:", err); return; }
      if (!row) {
        const adminId = generateId();
        // IMPORTANT: Never store plain text passwords in a real app. Use bcrypt or similar.
        db.run("INSERT INTO users (id, username, password, role, email) VALUES (?, ?, ?, ?, ?)",
          [adminId, 'admin', 'password', 'ADMIN', 'admin@example.com'], (errInsert) => {
            if (errInsert) console.error("Error inserting admin user:", errInsert);
            else console.log("Default admin user created.");
          });
      }
    });
    console.log("Database schema checked/initialized.");
    seedSampleData();
  });
}

function seedSampleData() {
    db.get("SELECT id FROM leagues WHERE id = 'l1'", (err, row) => {
        if (err) {
            console.error("Error checking for sample data:", err.message);
            return;
        }
        if (row) {
            console.log("Sample data already exists. Skipping seeding.");
            return;
        }

        console.log("Seeding sample data...");

        const sampleLeagues = [
            { id: 'l1', name: 'TATA IPL 2024', location: 'India', startDate: '2024-03-22T00:00:00Z', endDate: '2024-05-26T00:00:00Z' },
            { id: 'l2', name: 'Local Club Championship', location: 'City Grounds', startDate: '2024-07-01T00:00:00Z', endDate: '2024-08-15T00:00:00Z' },
        ];

        const samplePlayers = [
            { id: 'p_hardik', firstName: 'Hardik', lastName: 'Pandya', email: 'hardik.p@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_hardik` },
            { id: 'p_rohit', firstName: 'Rohit', lastName: 'Sharma', email: 'rohit.s@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_rohit` },
            { id: 'p_bumrah', firstName: 'Jasprit', lastName: 'Bumrah', email: 'jasprit.b@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_bumrah` },
            { id: 'p_ruturaj', firstName: 'Ruturaj', lastName: 'Gaikwad', email: 'rutu.g@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_ruturaj` },
            { id: 'p_msd', firstName: 'MS', lastName: 'Dhoni', email: 'ms.dhoni@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_msd` },
            { id: 'p_faf', firstName: 'Faf', lastName: 'du Plessis', email: 'faf.dp@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_faf` },
            { id: 'p_kohli', firstName: 'Virat', lastName: 'Kohli', email: 'virat.k@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_kohli` },
            { id: 'p_local1', firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_local1` },
            { id: 'p_local2', firstName: 'Priya', lastName: 'Singh', email: 'priya.singh@example.com', profilePictureUrl: `https://i.pravatar.cc/150?u=p_local2` },
        ];

        const sampleTeams = [
            { id: 't_mi', name: 'Mumbai Indians', leagueId: 'l1', captainId: 'p_hardik', logoUrl: 'https://picsum.photos/seed/t_mi/200/150' },
            { id: 't_csk', name: 'Chennai Super Kings', leagueId: 'l1', captainId: 'p_ruturaj', logoUrl: 'https://picsum.photos/seed/t_csk/200/150' },
            { id: 't_rcb', name: 'Royal Challengers Bengaluru', leagueId: 'l1', captainId: 'p_faf', logoUrl: 'https://picsum.photos/seed/t_rcb/200/150' },
            { id: 't_local_a', name: 'City Strikers', leagueId: 'l2', captainId: 'p_local1', logoUrl: 'https://picsum.photos/seed/t_local_a/200/150' },
            { id: 't_local_b', name: 'Ground Blasters', leagueId: 'l2', captainId: 'p_local2', logoUrl: 'https://picsum.photos/seed/t_local_b/200/150' },
        ];

        const samplePlayerTeams = [
            { playerId: 'p_hardik', teamId: 't_mi' }, { playerId: 'p_rohit', teamId: 't_mi' }, { playerId: 'p_bumrah', teamId: 't_mi' },
            { playerId: 'p_ruturaj', teamId: 't_csk' }, { playerId: 'p_msd', teamId: 't_csk' },
            { playerId: 'p_faf', teamId: 't_rcb' }, { playerId: 'p_kohli', teamId: 't_rcb' },
            { playerId: 'p_local1', teamId: 't_local_a' }, { playerId: 'p_local2', teamId: 't_local_b' },
            { playerId: 'p_rohit', teamId: 't_local_a' }, // Rohit also plays for a local team
        ];
        
        const now = new Date();
        const sampleMatches = [
            { id: 'm1', leagueId: 'l1', teamAId: 't_mi', teamBId: 't_csk', dateTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), venue: 'Wankhede Stadium, Mumbai', overs: 20, status: 'Scheduled' },
            { id: 'm2', leagueId: 'l1', teamAId: 't_rcb', teamBId: 't_mi', dateTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), venue: 'M. Chinnaswamy Stadium, Bengaluru', overs: 20, status: 'Scheduled' },
            { id: 'm3', leagueId: 'l2', teamAId: 't_local_a', teamBId: 't_local_b', dateTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), venue: 'City Ground A', overs: 15, status: 'Scheduled' },
            { id: 'm4', leagueId: 'l1', teamAId: 't_csk', teamBId: 't_rcb', dateTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), venue: 'MA Chidambaram Stadium, Chennai', overs: 20, status: 'Completed', result: 'CSK won by 6 wickets', tossWonByTeamId: 't_rcb', choseTo: 'Bat', scorecardId: 'sc_m4' },
        ];
         const sampleScorecards = [
            { id: 'sc_m4', matchId: 'm4', innings1: JSON.stringify({ battingTeamId: 't_rcb', bowlingTeamId: 't_csk', score: 173, wickets: 6, oversPlayed: 20.0, balls: [{over:0, ballInOver:1,bowlerId:'p_some_csk_bowler', batsmanId:'p_faf', nonStrikerId:'p_kohli', runsScored:1, extras:{}}] }), innings2: JSON.stringify({ battingTeamId: 't_csk', bowlingTeamId: 't_rcb', score: 176, wickets: 4, oversPlayed: 18.4, balls: [{over:0,ballInOver:1,bowlerId:'p_some_rcb_bowler',batsmanId:'p_ruturaj',nonStrikerId:'p_some_csk_player2',runsScored:4,extras:{}}] }) }
        ];


        db.serialize(() => {
            const leagueStmt = db.prepare("INSERT INTO leagues (id, name, location, startDate, endDate) VALUES (?, ?, ?, ?, ?)");
            for (const league of sampleLeagues) leagueStmt.run(league.id, league.name, league.location, league.startDate, league.endDate);
            leagueStmt.finalize();

            const playerStmt = db.prepare("INSERT INTO players (id, firstName, lastName, email, profilePictureUrl) VALUES (?, ?, ?, ?, ?)");
            for (const player of samplePlayers) playerStmt.run(player.id, player.firstName, player.lastName, player.email, player.profilePictureUrl);
            playerStmt.finalize();

            const teamStmt = db.prepare("INSERT INTO teams (id, name, leagueId, captainId, logoUrl) VALUES (?, ?, ?, ?, ?)");
            for (const team of sampleTeams) teamStmt.run(team.id, team.name, team.leagueId, team.captainId, team.logoUrl);
            teamStmt.finalize();

            const playerTeamStmt = db.prepare("INSERT INTO player_teams (playerId, teamId) VALUES (?, ?)");
            for (const pt of samplePlayerTeams) playerTeamStmt.run(pt.playerId, pt.teamId);
            playerTeamStmt.finalize();
            
            const matchStmt = db.prepare("INSERT INTO matches (id, leagueId, teamAId, teamBId, dateTime, venue, overs, status, result, tossWonByTeamId, choseTo, scorecardId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            for (const match of sampleMatches) matchStmt.run(match.id, match.leagueId, match.teamAId, match.teamBId, match.dateTime, match.venue, match.overs, match.status, match.result, match.tossWonByTeamId, match.choseTo, match.scorecardId);
            matchStmt.finalize();

            const scorecardStmt = db.prepare("INSERT INTO scorecards (id, matchId, innings1, innings2) VALUES (?, ?, ?, ?)");
            for (const sc of sampleScorecards) scorecardStmt.run(sc.id, sc.matchId, sc.innings1, sc.innings2);
            scorecardStmt.finalize();

            console.log("Sample data seeded successfully.");
        });
    });
}


// --- Middleware ---
app.use(cors());
app.use(express.json());

// Middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`Backend Request Received: ${req.method} ${req.originalUrl}`);
  next();
});

// --- Helper ---
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// --- API Routes ---

// USER AUTH
app.post('/api/login', (req, res) => { 
    const { username, password } = req.body;
    db.get("SELECT id, username, email, role, profilePictureUrl FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) {
            res.json(user);
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    });
});

app.get('/api/users/:id', (req, res) => { 
    db.get("SELECT id, username, email, role, profilePictureUrl FROM users WHERE id = ?", [req.params.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) res.json(user);
        else res.status(404).json({ error: "User not found" });
    });
});


// LEAGUES
app.get('/api/leagues', (req, res) => { 
  db.all("SELECT * FROM leagues ORDER BY startDate DESC", [], async (err, leagueRows) => {
    if (err) return res.status(500).json({ error: err.message });
    const leaguesWithDetails = [];
    for (const league of leagueRows) {
        const teamsInLeague = await new Promise((resolve, reject) => {
            db.all("SELECT id, name, leagueId FROM teams WHERE leagueId = ?", [league.id], (teamErr, teamRows) => {
                if (teamErr) reject(teamErr);
                else resolve(teamRows);
            });
        });
        leaguesWithDetails.push({ ...league, teams: teamsInLeague || [] });
    }
    res.json(leaguesWithDetails);
  });
});

app.post('/api/leagues', (req, res) => { 
  const { name, location, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) return res.status(400).json({ error: "Missing required fields: name, startDate, endDate" });
  const newLeague = { id: generateId(), name, location, startDate, endDate };
  db.run("INSERT INTO leagues (id, name, location, startDate, endDate) VALUES (?, ?, ?, ?, ?)",
    [newLeague.id, newLeague.name, newLeague.location, newLeague.startDate, newLeague.endDate],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ ...newLeague, teams: [] });
    }
  );
});

app.put('/api/leagues/:id', (req, res) => { 
    const { id } = req.params;
    const { name, location, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) return res.status(400).json({ error: "Missing required fields: name, startDate, endDate" });
    db.run("UPDATE leagues SET name = ?, location = ?, startDate = ?, endDate = ? WHERE id = ?",
        [name, location, startDate, endDate, id],
        async function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "League not found" });
            
            const updatedLeagueRow = await new Promise((resolve, reject) => {
                 db.get("SELECT * FROM leagues WHERE id = ?", [id], (errL, leagueRow) => {
                    if(errL) reject(errL); else resolve(leagueRow);
                 });
            });
            if (!updatedLeagueRow) return res.status(404).json({ error: "Updated league not found after update."})

            const teamsInLeague = await new Promise((resolve, reject) => {
                db.all("SELECT id, name, leagueId FROM teams WHERE leagueId = ?", [id], (teamErr, teamRows) => {
                    if (teamErr) reject(teamErr); else resolve(teamRows);
                });
            });
            res.json({ ...(updatedLeagueRow), teams: teamsInLeague || [] });
        }
    );
});

app.delete('/api/leagues/:id', (req, res) => { 
    const { id } = req.params;
    db.run("DELETE FROM leagues WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "League not found" });
        res.status(204).send();
    });
});


// TEAMS
app.get('/api/teams', (req, res) => { 
    const { leagueId } = req.query;
    let sql = `
        SELECT t.*, GROUP_CONCAT(pt.playerId) as playerIdsStr 
        FROM teams t 
        LEFT JOIN player_teams pt ON t.id = pt.teamId
    `;
    const params = [];
    if (leagueId) {
        sql += " WHERE t.leagueId = ?";
        params.push(leagueId);
    }
    sql += " GROUP BY t.id ORDER BY t.name";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const teams = rows.map(row => ({
            ...row,
            playerIds: row.playerIdsStr ? row.playerIdsStr.split(',') : [],
        }));
        res.json(teams);
    });
});

app.post('/api/teams', (req, res) => { 
    const { name, leagueId, captainId, logoUrl } = req.body;
    if (!name || !leagueId) return res.status(400).json({ error: "Team name and league are required" });
    const newTeam = { id: generateId(), name, leagueId, captainId: captainId || null, logoUrl: logoUrl || null };
    db.run("INSERT INTO teams (id, name, leagueId, captainId, logoUrl) VALUES (?, ?, ?, ?, ?)",
        [newTeam.id, newTeam.name, newTeam.leagueId, newTeam.captainId, newTeam.logoUrl],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ ...newTeam, playerIds: [], players: [] });
        }
    );
});

app.put('/api/teams/:id', (req, res) => { 
    const { id } = req.params;
    const { name, leagueId, captainId, logoUrl } = req.body; 
    if (!name || !leagueId) return res.status(400).json({ error: "Team name and league ID are required" });
    db.run("UPDATE teams SET name = ?, leagueId = ?, captainId = ?, logoUrl = ? WHERE id = ?",
        [name, leagueId, captainId || null, logoUrl || null, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Team not found" });
            db.get("SELECT t.*, GROUP_CONCAT(pt.playerId) as playerIdsStr FROM teams t LEFT JOIN player_teams pt ON t.id = pt.teamId WHERE t.id = ? GROUP BY t.id", [id], (errGet, row) => {
                if (errGet) return res.status(500).json({ error: errGet.message });
                 if(!row) return res.status(404).json({ error: "Updated team not found after update."})
                res.json({...row, playerIds: row.playerIdsStr ? row.playerIdsStr.split(',') : []});
            });
        }
    );
});

app.delete('/api/teams/:id', (req, res) => { 
    const { id } = req.params;
    db.run("DELETE FROM teams WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Team not found" });
        res.status(204).send();
    });
});

// PLAYERS
app.get('/api/players', (req, res) => { 
    const { teamId } = req.query;
    let sql = `
        SELECT p.*, GROUP_CONCAT(pt.teamId) as teamIdsStr 
        FROM players p 
        LEFT JOIN player_teams pt ON p.id = pt.playerId 
    `;
    const params = [];
    if (teamId) {
        sql = `SELECT p.*, GROUP_CONCAT(pt_all.teamId) as teamIdsStr
               FROM players p
               JOIN player_teams pt_filter ON p.id = pt_filter.playerId
               LEFT JOIN player_teams pt_all ON p.id = pt_all.playerId
               WHERE pt_filter.teamId = ?
               GROUP BY p.id
               ORDER BY p.lastName, p.firstName`;
        params.push(teamId);
    } else {
        sql += " GROUP BY p.id ORDER BY p.lastName, p.firstName";
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const players = rows.map(row => ({
            ...row,
            teamIds: row.teamIdsStr ? row.teamIdsStr.split(',').filter(id => id) : []
        }));
        res.json(players);
    });
});

app.post('/api/players', (req, res) => { 
    const { firstName, lastName, email, profilePictureUrl, initialTeamId } = req.body; // Changed from teamId
    if (!firstName || !lastName) return res.status(400).json({ error: "First and last name are required" });
    const newPlayerId = generateId();
    db.run("INSERT INTO players (id, firstName, lastName, email, profilePictureUrl) VALUES (?, ?, ?, ?, ?)",
        [newPlayerId, firstName, lastName, email || null, profilePictureUrl || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (initialTeamId) {
                db.run("INSERT INTO player_teams (playerId, teamId) VALUES (?, ?)", [newPlayerId, initialTeamId], (err_pt) => {
                    if (err_pt) console.error("Error assigning player to team:", err_pt.message);
                });
            }
            res.status(201).json({ id: newPlayerId, firstName, lastName, email, profilePictureUrl, teamIds: initialTeamId ? [initialTeamId] : [] });
        }
    );
});

app.put('/api/players/:id', (req, res) => { 
    const { id } = req.params;
    const { firstName, lastName, email, profilePictureUrl, teamIds = [] } = req.body;

    if (!firstName || !lastName) return res.status(400).json({ error: "First and last name are required" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        db.run("UPDATE players SET firstName = ?, lastName = ?, email = ?, profilePictureUrl = ? WHERE id = ?",
            [firstName, lastName, email || null, profilePictureUrl || null, id],
            function(err) {
                if (err) {
                    db.run("ROLLBACK;");
                    return res.status(500).json({ error: err.message });
                }
                if (this.changes === 0) {
                    db.run("ROLLBACK;");
                    return res.status(404).json({ error: "Player not found" });
                }

                db.run("DELETE FROM player_teams WHERE playerId = ?", [id], (errDel) => {
                    if (errDel) {
                        db.run("ROLLBACK;");
                        return res.status(500).json({ error: `Error clearing player teams: ${errDel.message}` });
                    }

                    if (teamIds && teamIds.length > 0) {
                        const stmt = db.prepare("INSERT INTO player_teams (playerId, teamId) VALUES (?, ?);");
                        teamIds.forEach(teamId => {
                            stmt.run(id, teamId, (errIns) => {
                                if(errIns) console.error(`Error adding player ${id} to team ${teamId}: ${errIns.message}`);
                            });
                        });
                        stmt.finalize((errFin) => {
                            if (errFin) {
                                db.run("ROLLBACK;");
                                return res.status(500).json({ error: `Finalizing team assignments failed: ${errFin.message}` });
                            }
                            db.run("COMMIT;", (commitErr) => {
                                if (commitErr) return res.status(500).json({ error: `Commit failed: ${commitErr.message}` });
                                db.get("SELECT p.*, GROUP_CONCAT(pt.teamId) as teamIdsStr FROM players p LEFT JOIN player_teams pt ON p.id = pt.playerId WHERE p.id = ? GROUP BY p.id", [id], (errGet, row) => {
                                    if (errGet) return res.status(500).json({ error: errGet.message });
                                    if(!row) return res.status(404).json({ error: "Updated player not found after team assignment."})
                                    res.json({ ...row, teamIds: row.teamIdsStr ? row.teamIdsStr.split(',') : [] });
                                });
                            });
                        });
                    } else { 
                        db.run("COMMIT;", (commitErr) => {
                            if (commitErr) return res.status(500).json({ error: `Commit failed: ${commitErr.message}` });
                            db.get("SELECT * FROM players WHERE id = ?", [id], (errGet, row) => {
                                 if (errGet) return res.status(500).json({ error: errGet.message });
                                 if(!row) return res.status(404).json({ error: "Updated player not found."})
                                 res.json({ ...row, teamIds: [] });
                            });
                        });
                    }
                });
            }
        );
    });
});

app.delete('/api/players/:id', (req, res) => { 
    const { id } = req.params;
    db.run("DELETE FROM players WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Player not found" });
        res.status(204).send();
    });
});


// MATCHES
app.get('/api/matches', (req, res) => { 
    const { leagueId } = req.query;
    let sql = "SELECT * FROM matches";
    const params = [];
    if (leagueId) {
        sql += " WHERE leagueId = ?";
        params.push(leagueId);
    }
    sql += " ORDER BY dateTime DESC";
    db.all(sql, params, (err, matches) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(matches);
    });
});

app.get('/api/matches/:id', (req, res) => { 
    db.get("SELECT * FROM matches WHERE id = ?", [req.params.id], (err, match) => {
        if (err) return res.status(500).json({ error: err.message });
        if (match) res.json(match);
        else res.status(404).json({error: "Match not found"});
    });
});

app.post('/api/matches', (req, res) => { 
    const { leagueId, teamAId, teamBId, dateTime, venue, overs, status, tossWonByTeamId, choseTo, umpire1, umpire2, result } = req.body;
    if (!leagueId || !teamAId || !teamBId || !dateTime || !venue || overs === undefined) {
        return res.status(400).json({ error: "Missing required fields for match" });
    }
    const newMatch = { 
        id: generateId(), leagueId, teamAId, teamBId, dateTime, venue, 
        overs: parseInt(overs, 10), status: status || 'Scheduled',
        tossWonByTeamId: tossWonByTeamId || null,
        choseTo: choseTo || null,
        umpire1: umpire1 || null,
        umpire2: umpire2 || null,
        result: result || null
    };
    db.run("INSERT INTO matches (id, leagueId, teamAId, teamBId, dateTime, venue, overs, status, tossWonByTeamId, choseTo, umpire1, umpire2, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newMatch.id, newMatch.leagueId, newMatch.teamAId, newMatch.teamBId, newMatch.dateTime, newMatch.venue, newMatch.overs, newMatch.status, newMatch.tossWonByTeamId, newMatch.choseTo, newMatch.umpire1, newMatch.umpire2, newMatch.result],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json(newMatch);
        }
    );
});

app.put('/api/matches/:id', (req, res) => { 
    const matchId = req.params.id;
    const { leagueId, teamAId, teamBId, dateTime, venue, overs, status, tossWonByTeamId, choseTo, umpire1, umpire2, result, scorecardId } = req.body;
    
    const fieldsToUpdate = {};
    if (leagueId !== undefined) fieldsToUpdate.leagueId = leagueId;
    if (teamAId !== undefined) fieldsToUpdate.teamAId = teamAId;
    if (teamBId !== undefined) fieldsToUpdate.teamBId = teamBId;
    if (dateTime !== undefined) fieldsToUpdate.dateTime = dateTime;
    if (venue !== undefined) fieldsToUpdate.venue = venue;
    if (overs !== undefined) fieldsToUpdate.overs = parseInt(overs, 10);
    if (status !== undefined) fieldsToUpdate.status = status;
    fieldsToUpdate.tossWonByTeamId = tossWonByTeamId === undefined ? null : tossWonByTeamId;
    fieldsToUpdate.choseTo = choseTo === undefined ? null : choseTo;
    fieldsToUpdate.umpire1 = umpire1 === undefined ? null : umpire1;
    fieldsToUpdate.umpire2 = umpire2 === undefined ? null : umpire2;
    fieldsToUpdate.result = result === undefined ? null : result;
    fieldsToUpdate.scorecardId = scorecardId === undefined ? null : scorecardId;

    const setClauses = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(", ");
    const params = [...Object.values(fieldsToUpdate), matchId];

    if (Object.keys(fieldsToUpdate).length === 0) return res.status(400).json({error: "No update fields provided"});
    
    db.run(`UPDATE matches SET ${setClauses} WHERE id = ?`, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({error: "Match not found or no changes made"});
        db.get("SELECT * FROM matches WHERE id = ?", [matchId], (errGet, updatedMatch) => {
            if(errGet) return res.status(500).json({error: errGet.message});
            res.json(updatedMatch);
        });
    });
});

app.delete('/api/matches/:id', (req, res) => { 
    const { id } = req.params;
    db.run("DELETE FROM matches WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Match not found" });
        res.status(204).send();
    });
});


// SCORECARDS
app.get('/api/scorecards/:matchId', (req, res) => { 
    db.get("SELECT * FROM scorecards WHERE matchId = ?", [req.params.matchId], (err, scorecard) => {
        if (err) return res.status(500).json({ error: err.message });
        if (scorecard) {
            try {
                scorecard.innings1 = scorecard.innings1 ? JSON.parse(scorecard.innings1) : null;
                scorecard.innings2 = scorecard.innings2 ? JSON.parse(scorecard.innings2) : null;
            } catch (e) {
                console.error("Error parsing scorecard innings JSON:", e);
                return res.status(500).json({ error: "Corrupted scorecard data in DB" });
            }
        }
        res.json(scorecard);
    });
});

app.put('/api/scorecards/:id', (req, res) => { 
    const scorecardId = req.params.id;
    const { matchId, innings1, innings2 } = req.body;
    if (!matchId) return res.status(400).json({ error: "Match ID is required for scorecard" });

    const innings1Json = innings1 ? JSON.stringify(innings1) : null;
    const innings2Json = innings2 ? JSON.stringify(innings2) : null;

    db.get("SELECT * FROM scorecards WHERE id = ?", [scorecardId], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing) {
            db.run("UPDATE scorecards SET innings1 = ?, innings2 = ? WHERE id = ?",
                [innings1Json, innings2Json, scorecardId],
                function(errUpdate) {
                    if (errUpdate) return res.status(500).json({ error: errUpdate.message });
                    res.json({ id: scorecardId, matchId, innings1, innings2 });
                }
            );
        } else { 
            db.run("INSERT INTO scorecards (id, matchId, innings1, innings2) VALUES (?, ?, ?, ?)",
                [scorecardId, matchId, innings1Json, innings2Json],
                function(errInsert) {
                    if (errInsert) return res.status(500).json({ error: errInsert.message });
                    db.run("UPDATE matches SET scorecardId = ? WHERE id = ?", [scorecardId, matchId], (errMatchUpdate) => {
                        if (errMatchUpdate) console.error("Error updating match with scorecardId:", errMatchUpdate.message);
                    });
                    res.status(201).json({ id: scorecardId, matchId, innings1, innings2 });
                }
            );
        }
    });
});

app.listen(PORT, () => {
  console.log(`Backend server running locally on port ${PORT}.`);
  console.log(`Simulated deployed service URL: https://cricket-scorer-pro-backend-prod.a.run.app`);
  console.log(`Ensure frontend BASE_API_URL targets: https://cricket-scorer-pro-backend-prod.a.run.app/api`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});

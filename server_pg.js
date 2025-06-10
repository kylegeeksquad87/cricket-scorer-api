
// server.js
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// --- PostgreSQL Connection Pool ---
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'cricket-scorer-461401:us-east1:cricket-scorer-pro-db',
  database: process.env.PGDATABASE || 'cricket_app_db',
  password: process.env.PGPASSWORD || 'admin87', // Ensure this is secure in production
  port: parseInt(process.env.PGPORT || '5432', 10),
});

pool.on('connect', client => {
  console.log('Connected to the PostgreSQL database.');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// --- Helper function to generate IDs ---
const generateId = () => Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);

// --- Database Schema Initialization ---
async function initializeDbSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, /* In a real app, store hashed passwords! */
      email TEXT,
      role TEXT NOT NULL,
      "profilePictureUrl" TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS leagues (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      location TEXT,
      "startDate" TIMESTAMPTZ NOT NULL,
      "endDate" TIMESTAMPTZ NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS players (
      id VARCHAR(255) PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      email TEXT UNIQUE,
      "profilePictureUrl" TEXT
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS teams (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      "leagueId" VARCHAR(255) NOT NULL,
      "captainId" VARCHAR(255),
      "logoUrl" TEXT,
      UNIQUE(name, "leagueId"),
      FOREIGN KEY ("leagueId") REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY ("captainId") REFERENCES players(id) ON DELETE SET NULL
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS player_teams (
        "playerId" VARCHAR(255) NOT NULL,
        "teamId" VARCHAR(255) NOT NULL,
        PRIMARY KEY ("playerId", "teamId"),
        FOREIGN KEY ("playerId") REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY ("teamId") REFERENCES teams(id) ON DELETE CASCADE
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS matches (
      id VARCHAR(255) PRIMARY KEY,
      "leagueId" VARCHAR(255) NOT NULL,
      "teamAId" VARCHAR(255) NOT NULL,
      "teamBId" VARCHAR(255) NOT NULL,
      "dateTime" TIMESTAMPTZ NOT NULL,
      venue TEXT,
      overs INTEGER DEFAULT 15,
      status TEXT DEFAULT 'Scheduled', 
      "tossWonByTeamId" VARCHAR(255),
      "choseTo" TEXT, 
      umpire1 TEXT,
      umpire2 TEXT,
      result TEXT,
      "scorecardId" VARCHAR(255) UNIQUE, 
      FOREIGN KEY ("leagueId") REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY ("teamAId") REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY ("teamBId") REFERENCES teams(id) ON DELETE CASCADE,
      CONSTRAINT check_different_teams CHECK ("teamAId" <> "teamBId")
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS scorecards (
        id VARCHAR(255) PRIMARY KEY,
        "matchId" VARCHAR(255) NOT NULL UNIQUE, 
        innings1 JSONB, 
        innings2 JSONB, 
        FOREIGN KEY ("matchId") REFERENCES matches(id) ON DELETE CASCADE
    )`);


    const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rowCount === 0) {
      const adminId = generateId();
      // Note: "profilePictureUrl" is quoted here in INSERT to match DDL
      await client.query(`INSERT INTO users (id, username, password, role, email, "profilePictureUrl") VALUES ($1, $2, $3, $4, $5, $6)`,
        [adminId, 'admin', 'password', 'ADMIN', 'admin@example.com', null]); // HASH PASSWORDS IN REAL APP
      console.log("Default admin user created.");
    }
    
    await client.query('COMMIT');
    console.log("Database schema checked/initialized for PostgreSQL with quoted identifiers.");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL database schema:', e);
    throw e; 
  } finally {
    client.release();
  }
}

async function seedSampleData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const sampleLeagueCheck = await client.query("SELECT id FROM leagues WHERE id = 'l1_sample_ipl'");
        if (sampleLeagueCheck.rowCount > 0) {
            console.log("Sample data likely already exists. Skipping seeding.");
            await client.query('COMMIT'); 
            client.release();
            return;
        }

        console.log("Seeding sample data into PostgreSQL...");

        const leaguesData = [
            { id: 'l1_sample_ipl', name: 'TATA IPL 2024 (Sample)', location: 'India', startDate: '2024-03-22T00:00:00Z', endDate: '2024-05-26T00:00:00Z' },
            { id: 'l2_sample_local', name: 'Local Club Championship (Sample)', location: 'Community Grounds', startDate: '2024-06-01T00:00:00Z', endDate: '2024-07-30T00:00:00Z' },
        ];
        for (const league of leaguesData) {
            await client.query(`INSERT INTO leagues (id, name, location, "startDate", "endDate") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
                [league.id, league.name, league.location, league.startDate, league.endDate]);
        }

        const playersData = [
            { id: 'p_sample_rohit', firstName: 'Rohit', lastName: 'Sharma (Sample)', email: 'rohit.sample@example.com', profilePictureUrl: 'https://via.placeholder.com/150' },
            { id: 'p_sample_virat', firstName: 'Virat', lastName: 'Kohli (Sample)', email: 'virat.sample@example.com', profilePictureUrl: null },
            { id: 'p_sample_bumrah', firstName: 'Jasprit', lastName: 'Bumrah (Sample)', email: 'jasprit.sample@example.com', profilePictureUrl: null },
            { id: 'p_sample_local1', firstName: 'Alex', lastName: 'Local (Sample)', email: 'alex.local.sample@example.com', profilePictureUrl: null},
            { id: 'p_sample_local2', firstName: 'Sarah', lastName: 'Club (Sample)', email: 'sarah.club.sample@example.com', profilePictureUrl: null},
        ];
        for (const player of playersData) {
            await client.query(`INSERT INTO players (id, "firstName", "lastName", email, "profilePictureUrl") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
                [player.id, player.firstName, player.lastName, player.email, player.profilePictureUrl]);
        }

        const teamsData = [
            { id: 't_sample_mi', name: 'Mumbai Champions (Sample)', leagueId: 'l1_sample_ipl', captainId: 'p_sample_rohit', logoUrl: 'https://via.placeholder.com/100?text=MI' },
            { id: 't_sample_rcb', name: 'Bengaluru Royals (Sample)', leagueId: 'l1_sample_ipl', captainId: 'p_sample_virat', logoUrl: 'https://via.placeholder.com/100?text=RCB' },
            { id: 't_sample_lions', name: 'Community Lions (Sample)', leagueId: 'l2_sample_local', captainId: 'p_sample_local1', logoUrl: null },
            { id: 't_sample_tigers', name: 'Park Tigers (Sample)', leagueId: 'l2_sample_local', captainId: 'p_sample_local2', logoUrl: null },
        ];
        for (const team of teamsData) {
            await client.query(`INSERT INTO teams (id, name, "leagueId", "captainId", "logoUrl") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
                [team.id, team.name, team.leagueId, team.captainId, team.logoUrl]);
        }
        
        const playerTeamsData = [
            { playerId: 'p_sample_rohit', teamId: 't_sample_mi' }, { playerId: 'p_sample_bumrah', teamId: 't_sample_mi' },
            { playerId: 'p_sample_virat', teamId: 't_sample_rcb' },
            { playerId: 'p_sample_local1', teamId: 't_sample_lions' }, { playerId: 'p_sample_local2', teamId: 't_sample_tigers' },
            { playerId: 'p_sample_local2', teamId: 't_sample_lions' },
        ];
        for (const pt of playerTeamsData) {
            await client.query(`INSERT INTO player_teams ("playerId", "teamId") VALUES ($1, $2) ON CONFLICT ("playerId", "teamId") DO NOTHING`, [pt.playerId, pt.teamId]);
        }

        const matchesData = [
            { id: 'm_sample_1', leagueId: 'l1_sample_ipl', teamAId: 't_sample_mi', teamBId: 't_sample_rcb', dateTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), venue: 'Wankhede Stadium (Sample)', overs: 20, status: 'Completed', result: 'Mumbai Champions (Sample) won by 10 runs', tossWonByTeamId: 't_sample_mi', choseTo: 'Bat', scorecardId: 'sc_m_sample_1'},
            { id: 'm_sample_2', leagueId: 'l1_sample_ipl', teamAId: 't_sample_mi', teamBId: 't_sample_rcb', dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), venue: 'Chinnaswamy Stadium (Sample)', overs: 20, status: 'Scheduled', result: null, tossWonByTeamId: null, choseTo: null, scorecardId: null },
            { id: 'm_sample_3', leagueId: 'l2_sample_local', teamAId: 't_sample_lions', teamBId: 't_sample_tigers', dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), venue: 'Local Park A (Sample)', overs: 15, status: 'Scheduled', result: null, tossWonByTeamId: null, choseTo: null, scorecardId: null },
        ];
        for (const match of matchesData) {
             await client.query(`INSERT INTO matches (id, "leagueId", "teamAId", "teamBId", "dateTime", venue, overs, status, result, "tossWonByTeamId", "choseTo", "scorecardId") 
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
                [match.id, match.leagueId, match.teamAId, match.teamBId, match.dateTime, match.venue, match.overs, match.status, match.result, match.tossWonByTeamId, match.choseTo, match.scorecardId]);
        }
        
        const scorecardsData = [{
            id: 'sc_m_sample_1', matchId: 'm_sample_1',
            innings1: { battingTeamId: 't_sample_mi', bowlingTeamId: 't_sample_rcb', score: 180, wickets: 5, oversPlayed: 20.0, balls: [{over:0, ballInOver:1, bowlerId: 'p_sample_virat', batsmanId:'p_sample_rohit', runsScored:4, extras:{}}] },
            innings2: { battingTeamId: 't_sample_rcb', bowlingTeamId: 't_sample_mi', score: 170, wickets: 7, oversPlayed: 20.0, balls: [] },
        }];
        for (const sc of scorecardsData) {
            const matchCheck = await client.query("SELECT id FROM matches WHERE id = $1", [sc.matchId]);
            if (matchCheck.rowCount > 0) {
                await client.query(`INSERT INTO scorecards (id, "matchId", innings1, innings2) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, 
                                   [sc.id, sc.matchId, sc.innings1, sc.innings2]);
            } else {
                console.warn(`Skipping scorecard for non-existent matchId: ${sc.matchId}`);
            }
        }

        await client.query('COMMIT');
        console.log("Sample data seeded successfully into PostgreSQL.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error seeding sample data into PostgreSQL:', e);
    } finally {
        client.release();
    }
}


// --- Middleware ---
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`PG Backend Request: ${req.method} ${req.originalUrl}`);
  next();
});

// --- API Routes ---

// USER AUTH
app.post('/api/login', async (req, res) => { 
    const { username, password } = req.body;
    try {
        // "profilePictureUrl" is quoted because DDL uses quotes
        const result = await pool.query(`SELECT id, username, email, role, "profilePictureUrl" FROM users WHERE username = $1 AND password = $2`, [username, password]); // HASH PASSWORDS!
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: "Database error during login" });
    }
});

app.get('/api/users/:id', async (req, res) => { 
    try {
        const result = await pool.query(`SELECT id, username, email, role, "profilePictureUrl" FROM users WHERE id = $1`, [req.params.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: "Database error fetching user" });
    }
});

// LEAGUES
app.get('/api/leagues', async (req, res) => { 
  try {
    const result = await pool.query(`
      SELECT l.id, l.name, l.location, l."startDate", l."endDate", 
             COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'leagueId', t."leagueId")) FILTER (WHERE t.id IS NOT NULL), '[]') as teams
      FROM leagues l
      LEFT JOIN teams t ON l.id = t."leagueId"
      GROUP BY l.id, l.name, l.location, l."startDate", l."endDate"
      ORDER BY l."startDate" DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get leagues error:', err);
    res.status(500).json({ error: "Database error fetching leagues" });
  }
});

app.post('/api/leagues', async (req, res) => { 
  const { name, location, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) return res.status(400).json({ error: "Missing required fields: name, startDate, endDate" });
  const newLeagueId = generateId();
  try {
    const result = await pool.query(`INSERT INTO leagues (id, name, location, "startDate", "endDate") VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [newLeagueId, name, location, startDate, endDate]);
    res.status(201).json({ ...result.rows[0], teams: [] }); 
  } catch (err) {
    console.error('Create league error:', err);
    if (err.code === '23505') { 
        return res.status(409).json({ error: "League name already exists." });
    }
    res.status(500).json({ error: "Database error creating league" });
  }
});

app.put('/api/leagues/:id', async (req, res) => {
    const { id } = req.params;
    const { name, location, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) return res.status(400).json({ error: "Missing required fields" });
    try {
        const result = await pool.query(
            `UPDATE leagues SET name = $1, location = $2, "startDate" = $3, "endDate" = $4 WHERE id = $5 RETURNING *`,
            [name, location, startDate, endDate, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "League not found" });
        
        const teamsResult = await pool.query(`SELECT id, name, "leagueId" FROM teams WHERE "leagueId" = $1`, [id]);
        res.json({ ...result.rows[0], teams: teamsResult.rows || [] });

    } catch (err) {
        console.error('Update league error:', err);
         if (err.code === '23505') { 
            return res.status(409).json({ error: "League name already exists (for another league)." });
        }
        res.status(500).json({ error: "Database error updating league" });
    }
});

app.delete('/api/leagues/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM leagues WHERE id = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "League not found" });
        res.status(204).send();
    } catch (err) {
        console.error('Delete league error:', err);
        res.status(500).json({ error: "Database error deleting league" });
    }
});


// TEAMS
app.get('/api/teams', async (req, res) => { 
    const { leagueId } = req.query;
    // Adjusted to use quoted identifiers for selected columns from teams t
    let sql = `
        SELECT t.id, t.name, t."leagueId", t."captainId", t."logoUrl", 
               COALESCE(STRING_AGG(pt."playerId"::text, ','), '') as "playerIdsStr"
        FROM teams t 
        LEFT JOIN player_teams pt ON t.id = pt."teamId"
    `;
    const params = [];
    if (leagueId) {
        sql += ` WHERE t."leagueId" = $1`; // Use quoted "leagueId"
        params.push(leagueId);
    }
    // Group by all selected non-aggregated columns from teams t
    sql += ` GROUP BY t.id, t.name, t."leagueId", t."captainId", t."logoUrl" ORDER BY t.name`;

    try {
        const result = await pool.query(sql, params);
        const teams = result.rows.map(row => ({
            ...row, // Spread operator handles mapping from potentially quoted DB names to JS object keys if pg driver does this
            playerIds: row.playerIdsStr ? row.playerIdsStr.split(',') : [], // Access as playerIdsStr (lowercase if not quoted in SELECT AS)
        }));
        res.json(teams);
    } catch (err) {
        console.error('Get teams error:', err);
        res.status(500).json({ error: "Database error fetching teams" });
    }
});


app.post('/api/teams', async (req, res) => { 
    const { name, leagueId, captainId, logoUrl } = req.body;
    if (!name || !leagueId) return res.status(400).json({ error: "Team name and league are required" });
    const newTeamId = generateId();
    try {
        const result = await pool.query(
            `INSERT INTO teams (id, name, "leagueId", "captainId", "logoUrl") VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [newTeamId, name, leagueId, captainId || null, logoUrl || null]
        );
        res.status(201).json({ ...result.rows[0], playerIds: [], players: [] });
    } catch (err) {
        console.error('Create team error:', err);
         if (err.code === '23505') { 
            return res.status(409).json({ error: "Team name already exists in this league." });
        }
        res.status(500).json({ error: "Database error creating team" });
    }
});

app.put('/api/teams/:id', async (req, res) => {
    const { id } = req.params;
    const { name, leagueId, captainId, logoUrl } = req.body; 
    if (!name || !leagueId) return res.status(400).json({ error: "Team name and league ID are required" });
    try {
        const updateResult = await pool.query(
            `UPDATE teams SET name = $1, "leagueId" = $2, "captainId" = $3, "logoUrl" = $4 WHERE id = $5 RETURNING *`,
            [name, leagueId, captainId || null, logoUrl || null, id]
        );
        if (updateResult.rowCount === 0) return res.status(404).json({ error: "Team not found" });
        
        const teamRow = updateResult.rows[0];
        const playersResult = await pool.query(`SELECT "playerId" FROM player_teams WHERE "teamId" = $1`, [id]);
        // Ensure "playerId" is accessed correctly, matching the DDL. If it's quoted "playerId", it's "playerId".
        const playerIds = playersResult.rows.map(r => r.playerId); 

        res.json({ ...teamRow, playerIds });
    } catch (err) {
        console.error('Update team error:', err);
        if (err.code === '23505') { 
            return res.status(409).json({ error: "Team name already exists in this league (for another team)." });
        }
        res.status(500).json({ error: "Database error updating team" });
    }
});

app.delete('/api/teams/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM teams WHERE id = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Team not found" });
        res.status(204).send();
    } catch (err) {
        console.error('Delete team error:', err);
        res.status(500).json({ error: "Database error deleting team" });
    }
});


// PLAYERS
app.get('/api/players', async (req, res) => { 
    const { teamId } = req.query;
    let sqlQuery;
    const params = [];

    if (teamId) {
        sqlQuery = `
            SELECT p.id, p."firstName", p."lastName", p.email, p."profilePictureUrl", 
                   COALESCE(STRING_AGG(pt_all."teamId"::text, ','), '') as "teamIdsStr"
            FROM players p
            INNER JOIN player_teams pt_filter ON p.id = pt_filter."playerId" AND pt_filter."teamId" = $1
            LEFT JOIN player_teams pt_all ON p.id = pt_all."playerId"
            GROUP BY p.id, p."firstName", p."lastName", p.email, p."profilePictureUrl"
            ORDER BY p."lastName", p."firstName"`;
        params.push(teamId);
    } else {
        sqlQuery = `
            SELECT p.id, p."firstName", p."lastName", p.email, p."profilePictureUrl", 
                   COALESCE(STRING_AGG(pt."teamId"::text, ','), '') as "teamIdsStr"
            FROM players p 
            LEFT JOIN player_teams pt ON p.id = pt."playerId"
            GROUP BY p.id, p."firstName", p."lastName", p.email, p."profilePictureUrl"
            ORDER BY p."lastName", p."firstName"`;
    }

    try {
        const result = await pool.query(sqlQuery, params);
        const players = result.rows.map(row => ({
            ...row,
            teamIds: row.teamIdsStr ? row.teamIdsStr.split(',').filter(id => id) : []
        }));
        res.json(players);
    } catch (err) {
        console.error('Get players error:', err);
        res.status(500).json({ error: "Database error fetching players" });
    }
});

app.post('/api/players', async (req, res) => { 
    const { firstName, lastName, email, profilePictureUrl, teamId } = req.body; 
    if (!firstName || !lastName) return res.status(400).json({ error: "First and last name are required" });
    const newPlayerId = generateId();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerResult = await client.query(
            `INSERT INTO players (id, "firstName", "lastName", email, "profilePictureUrl") VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [newPlayerId, firstName, lastName, email || null, profilePictureUrl || null]
        );
        const newPlayer = playerResult.rows[0];
        let assignedTeamIds = [];
        if (teamId) {
            await client.query(`INSERT INTO player_teams ("playerId", "teamId") VALUES ($1, $2) ON CONFLICT ("playerId", "teamId") DO NOTHING`, [newPlayerId, teamId]);
            assignedTeamIds.push(teamId);
        }
        await client.query('COMMIT');
        res.status(201).json({ ...newPlayer, teamIds: assignedTeamIds });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create player error:', err);
        if (err.code === '23505' && err.constraint === 'players_email_key') {
             return res.status(409).json({ error: "Email already exists for another player." });
        }
        res.status(500).json({ error: "Database error creating player" });
    } finally {
        client.release();
    }
});

app.put('/api/players/:id', async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, profilePictureUrl, teamIds = [] } = req.body;

    if (!firstName || !lastName) return res.status(400).json({ error: "First and last name are required" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerUpdateResult = await client.query(
            `UPDATE players SET "firstName" = $1, "lastName" = $2, email = $3, "profilePictureUrl" = $4 WHERE id = $5 RETURNING *`,
            [firstName, lastName, email || null, profilePictureUrl || null, id]
        );

        if (playerUpdateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Player not found" });
        }
        const updatedPlayer = playerUpdateResult.rows[0];

        await client.query(`DELETE FROM player_teams WHERE "playerId" = $1`, [id]);

        if (Array.isArray(teamIds) && teamIds.length > 0) {
            for (const tid of teamIds) {
                 if (tid) { 
                    await client.query(`INSERT INTO player_teams ("playerId", "teamId") VALUES ($1, $2) ON CONFLICT ("playerId", "teamId") DO NOTHING`, [id, tid]);
                 }
            }
        }
        await client.query('COMMIT');
        res.json({ ...updatedPlayer, teamIds: teamIds.filter(tid => tid) }); 
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update player error:', err);
         if (err.code === '23505' && err.constraint === 'players_email_key') {
             return res.status(409).json({ error: "Email already exists for another player." });
        }
        res.status(500).json({ error: "Database error updating player" });
    } finally {
        client.release();
    }
});

app.delete('/api/players/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM players WHERE id = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Player not found" });
        res.status(204).send();
    } catch (err) {
        console.error('Delete player error:', err);
        res.status(500).json({ error: "Database error deleting player" });
    }
});


// MATCHES
app.get('/api/matches', async (req, res) => { 
    const { leagueId } = req.query;
    let sql = `SELECT id, "leagueId", "teamAId", "teamBId", "dateTime", venue, overs, status, "tossWonByTeamId", "choseTo", umpire1, umpire2, result, "scorecardId" FROM matches`;
    const params = [];
    if (leagueId) {
        sql += ` WHERE "leagueId" = $1`;
        params.push(leagueId);
    }
    sql += ` ORDER BY "dateTime" DESC`;
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get matches error:', err);
        res.status(500).json({ error: "Database error fetching matches" });
    }
});

app.get('/api/matches/:id', async (req, res) => { 
    try {
        const result = await pool.query(`SELECT id, "leagueId", "teamAId", "teamBId", "dateTime", venue, overs, status, "tossWonByTeamId", "choseTo", umpire1, umpire2, result, "scorecardId" FROM matches WHERE id = $1`, [req.params.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({error: "Match not found"});
        }
    } catch (err) {
        console.error('Get match by ID error:', err);
        res.status(500).json({ error: "Database error fetching match" });
    }
});

app.post('/api/matches', async (req, res) => { 
    const { leagueId, teamAId, teamBId, dateTime, venue, overs, status } = req.body;
    if (!leagueId || !teamAId || !teamBId || !dateTime || !venue || overs === undefined) {
        return res.status(400).json({ error: "Missing required fields for match" });
    }
    if (teamAId === teamBId) {
        return res.status(400).json({ error: "Team A and Team B cannot be the same." });
    }
    const newMatchId = generateId();
    const matchStatus = status || 'Scheduled';
    try {
        const result = await pool.query(
            `INSERT INTO matches (id, "leagueId", "teamAId", "teamBId", "dateTime", venue, overs, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [newMatchId, leagueId, teamAId, teamBId, dateTime, venue, parseInt(overs, 10), matchStatus]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create match error:', err);
        res.status(500).json({ error: "Database error creating match" });
    }
});

app.put('/api/matches/:id', async (req, res) => {
    const matchId = req.params.id;
    const { leagueId, teamAId, teamBId, dateTime, venue, overs, status, 
            tossWonByTeamId, choseTo, umpire1, umpire2, result, scorecardId } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentMatch = await client.query("SELECT * FROM matches WHERE id = $1", [matchId]);
        if(currentMatch.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({error: "Match not found"});
        }

        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (leagueId !== undefined) { updateFields.push(`"leagueId" = $${paramIndex++}`); updateValues.push(leagueId); }
        if (teamAId !== undefined) { updateFields.push(`"teamAId" = $${paramIndex++}`); updateValues.push(teamAId); }
        if (teamBId !== undefined) { updateFields.push(`"teamBId" = $${paramIndex++}`); updateValues.push(teamBId); }
        if (dateTime !== undefined) { updateFields.push(`"dateTime" = $${paramIndex++}`); updateValues.push(dateTime); }
        if (venue !== undefined) { updateFields.push(`venue = $${paramIndex++}`); updateValues.push(venue); }
        if (overs !== undefined) { updateFields.push(`overs = $${paramIndex++}`); updateValues.push(parseInt(overs, 10)); }
        if (status !== undefined) { updateFields.push(`status = $${paramIndex++}`); updateValues.push(status); }
        
        if (tossWonByTeamId !== undefined) { updateFields.push(`"tossWonByTeamId" = $${paramIndex++}`); updateValues.push(tossWonByTeamId === '' ? null : tossWonByTeamId); }
        if (choseTo !== undefined) { updateFields.push(`"choseTo" = $${paramIndex++}`); updateValues.push(choseTo === '' ? null : choseTo); }
        if (umpire1 !== undefined) { updateFields.push(`umpire1 = $${paramIndex++}`); updateValues.push(umpire1 === '' ? null : umpire1); }
        if (umpire2 !== undefined) { updateFields.push(`umpire2 = $${paramIndex++}`); updateValues.push(umpire2 === '' ? null : umpire2); }
        if (result !== undefined) { updateFields.push(`result = $${paramIndex++}`); updateValues.push(result === '' ? null : result); }
        if (scorecardId !== undefined) { updateFields.push(`"scorecardId" = $${paramIndex++}`); updateValues.push(scorecardId === '' ? null : scorecardId); }


        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({error: "No update fields provided"});
        }
        
        updateValues.push(matchId);
        const query = `UPDATE matches SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
        
        const result = await client.query(query, updateValues);
        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update match error:', err);
        if (err.code === '23514' && err.constraint === 'check_different_teams') { 
             return res.status(400).json({ error: "Team A and Team B cannot be the same." });
        }
        res.status(500).json({ error: "Database error updating match" });
    } finally {
        client.release();
    }
});

app.delete('/api/matches/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM matches WHERE id = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Match not found" });
        res.status(204).send();
    } catch (err) {
        console.error('Delete match error:', err);
        res.status(500).json({ error: "Database error deleting match" });
    }
});


// SCORECARDS
app.get('/api/scorecards/:matchId', async (req, res) => { 
    try {
        // Use "matchId" from DDL
        const result = await pool.query(`SELECT * FROM scorecards WHERE "matchId" = $1`, [req.params.matchId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]); 
        } else {
            res.json(null); 
        }
    } catch (err) {
        console.error('Get scorecard error:', err);
        res.status(500).json({ error: "Database error fetching scorecard" });
    }
});

app.put('/api/scorecards/:id', async (req, res) => { 
    const scorecardId = req.params.id; 
    const { matchId, innings1, innings2 } = req.body;
    if (!matchId) return res.status(400).json({ error: "Match ID is required for scorecard" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existingResult = await client.query("SELECT id FROM scorecards WHERE id = $1", [scorecardId]);
        let finalScorecard;

        if (existingResult.rowCount > 0) {
            const updateResult = await client.query(
                `UPDATE scorecards SET innings1 = $1, innings2 = $2, "matchId" = $3 WHERE id = $4 RETURNING *`,
                [innings1, innings2, matchId, scorecardId]
            );
            finalScorecard = updateResult.rows[0];
        } else { 
            const insertResult = await client.query(
                `INSERT INTO scorecards (id, "matchId", innings1, innings2) VALUES ($1, $2, $3, $4) RETURNING *`,
                [scorecardId, matchId, innings1, innings2] 
            );
            finalScorecard = insertResult.rows[0];
            await client.query(`UPDATE matches SET "scorecardId" = $1 WHERE id = $2`, [scorecardId, matchId]);
        }
        await client.query('COMMIT');
        res.status(existingResult.rowCount > 0 ? 200 : 201).json(finalScorecard);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Save scorecard error:', err);
        if (err.code === '23503' && err.constraint === 'scorecards_matchid_fkey') { 
            return res.status(400).json({ error: `Match with ID ${matchId} does not exist.` });
        }
        res.status(500).json({ error: "Database error saving scorecard" });
    } finally {
        client.release();
    }
});


async function startServer() {
  try {
    await initializeDbSchema();
    await seedSampleData(); 
    app.listen(PORT, () => {
      console.log(`PostgreSQL Backend server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to initialize and start server with PostgreSQL:", err);
    process.exit(1); 
  }
}

startServer();

const cleanup = async () => {
  console.log("Shutting down PostgreSQL pool...");
  await pool.end();
  console.log("PostgreSQL pool has ended.");
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Ensure all references in SELECT, INSERT, UPDATE for camelCased columns also use quotes if the DDL uses quotes.
// For example, in GET /api/leagues, l."startDate", l."endDate" etc.
// In GET /api/teams, t."leagueId", t."captainId", pt."playerId", pt."teamId" etc.
// In GET /api/players, p."firstName", pt_all."teamId" etc.
// This has been applied in the updated code above.
    
    

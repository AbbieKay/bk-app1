const firebaseConfig = {
    apiKey: "AIzaSyAAt7HzzcC08r6ClOHJH4ZMo9MwG_oaCL4",
    authDomain: "bk-gala-427f8.firebaseapp.com",
    projectId: "bk-gala-427f8",
    storageBucket: "bk-gala-427f8.firebasestorage.app",
    messagingSenderId: "494503454215",
    appId: "1:494503454215:web:cda1e0c0fbb845dfaf2ca2",
    measurementId: "G-M3VCK213NP"

};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const TOURNAMENT_DOC = "config/main";

let state = defaultState();
let isAdmin = false;
let unsubscribe = null;
let currentView = "dashboard";

function defaultState() {
  const games = ["Football", "Basketball", "Volleyball", "Table Tennis", "Chess", "FIFA"].map(name => ({
    id: makeId("game"), name, format: "knockout",
    participantIds: [], seeds: [], groups: null, fixtures: null, drawnAt: null
  }));
  return {
    tournamentName: "Inter-Organisation Tournament",
    adminCode: "admin123",
    organisations: [],
    games,
    selectedGameId: games[0].id
  };
}

function getSelectedGame() {
  let game = state.games.find(g => g.id === state.selectedGameId);
  if (!game && state.games.length > 0) {
    game = state.games[0];
    state.selectedGameId = game.id;
  }
  return game;
}

async function initTournament() {
  const docRef = db.doc(TOURNAMENT_DOC);
  const snap = await docRef.get();
  if (!snap.exists) {
    await docRef.set(state);
  } else {
    state = snap.data();
  }
  subscribeToTournament();
  renderAll();
}

function subscribeToTournament() {
  if (unsubscribe) unsubscribe();
  unsubscribe = db.doc(TOURNAMENT_DOC).onSnapshot((snap) => {
    if (snap.exists) {
      state = snap.data();
      renderAll();
    }
  }, (err) => console.error("Firestore error:", err));
}

async function saveToFirestore() {
  if (!isAdmin) return;
  try {
    await db.doc(TOURNAMENT_DOC).set(state);
  } catch (err) {
    console.error("Save error:", err);
    alert("Could not save.");
  }
}

function toggleAdminMode() {
  if (isAdmin) {
    isAdmin = false;
    updateModeUI();
    return;
  }
  const code = prompt("Enter admin code:");
  if (!code) return;
  if (code === state.adminCode) {
    isAdmin = true;
    updateModeUI();
  } else {
    alert("Incorrect admin code.");
  }
}

function updateModeUI() {
  const badge = document.getElementById("modeBadge");
  const label = document.getElementById("modeLabel");
  const adminPanel = document.getElementById("adminPanel");
  const btn = document.getElementById("adminToggleBtn");
  const clearBtn = document.getElementById("clearResultsBtn");

  if (isAdmin) {
    badge.className = "mode-badge bg-amber-600 text-white no-print";
    label.textContent = "Admin Mode";
    adminPanel.classList.remove("hidden");
    btn.textContent = "Exit Admin";
    btn.className = "bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold no-print";
    clearBtn.classList.remove("hidden");
  } else {
    badge.className = "mode-badge bg-gray-800 text-gray-300 border border-gray-700 no-print";
    label.textContent = "Viewer Mode";
    adminPanel.classList.add("hidden");
    btn.textContent = "Admin Login";
    btn.className = "bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold no-print";
    clearBtn.classList.add("hidden");
  }
}

function shareLink() {
  const url = window.location.href.split("?")[0];
  navigator.clipboard.writeText(url)
    .then(() => alert("Viewer link copied!\n\n" + url))
    .catch(() => prompt("Copy this link:", url));
}

function showDashboard() {
  currentView = "dashboard";
  document.getElementById("dashboardView").classList.remove("hidden");
  document.getElementById("gameDetailView").classList.add("hidden");
  document.getElementById("dashboardBtn").classList.add("hidden");
  renderAll();
}

function showGameDetail(gameId) {
  currentView = "gameDetail";
  state.selectedGameId = gameId;
  document.getElementById("dashboardView").classList.add("hidden");
  document.getElementById("gameDetailView").classList.remove("hidden");
  document.getElementById("dashboardBtn").classList.remove("hidden");
  saveToFirestore();
  renderAll();
}

function renderAll() {
  document.getElementById("tournamentTitle").textContent = state.tournamentName;
  
  if (currentView === "dashboard") {
    renderDashboard();
  } else {
    renderGameDetailView();
  }
}

// Organisation Management
function updateTournamentName(value) {
  state.tournamentName = value.trim() || "Tournament";
  saveToFirestore();
}

function updateAdminCode(value) {
  if (value.trim()) state.adminCode = value.trim();
  saveToFirestore();
}

function addSingleOrganisation() {
  const input = document.getElementById("singleOrganisation");
  const name = input.value.trim();
  if (!name) return;
  const result = addOrganisationsFromText(name);
  input.value = "";
  if (result.added === 0) alert("Already exists.");
  saveToFirestore();
  renderAll();
}

function addBulkOrganisations() {
  const textarea = document.getElementById("bulkOrganisations");
  const result = addOrganisationsFromText(textarea.value);
  textarea.value = "";
  alert(result.added + " added. " + result.skipped + " skipped.");
  saveToFirestore();
  renderAll();
}

function handleOrganisationFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const result = addOrganisationsFromText(e.target.result);
    alert(result.added + " added. " + result.skipped + " skipped.");
    event.target.value = "";
    saveToFirestore();
    renderAll();
  };
  reader.readAsText(file);
}

function cleanOrganisationLine(line) {
  let value = line.trim();
  if (!value) return "";
  value = value.split(",")[0].trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).trim();
  value = value.replace(/\s+/g, " ").trim();
  const skipped = ["organisation", "organisations", "organization", "organizations", "name", "team"];
  if (skipped.includes(value.toLowerCase())) return "";
  return value;
}

function addOrganisationsFromText(text) {
  const existing = new Set(state.organisations.map(o => o.name.toLowerCase()));
  const lines = String(text).split(/\r?\n/);
  let added = 0, skipped = 0;
  lines.forEach(line => {
    const name = cleanOrganisationLine(line);
    if (!name) { skipped++; return; }
    const key = name.toLowerCase();
    if (existing.has(key)) { skipped++; return; }
    state.organisations.push({ id: makeId("org"), name });
    existing.add(key);
    added++;
  });
  return { added, skipped };
}

function removeOrganisation(id) {
  const org = state.organisations.find(o => o.id === id);
  if (!org) return;
  if (!confirm("Remove " + org.name + "?")) return;
  state.organisations = state.organisations.filter(o => o.id !== id);
  state.games.forEach(game => {
    if (game.participantIds.includes(id)) {
      game.participantIds = game.participantIds.filter(pid => pid !== id);
      game.seeds = []; game.groups = null; game.fixtures = null; game.drawnAt = null;
    }
  });
  saveToFirestore();
  renderAll();
}

function clearAllOrganisations() {
  if (!confirm("Clear all organisations and draws?")) return;
  state.organisations = [];
  state.games.forEach(g => { g.participantIds = []; g.seeds = []; g.groups = null; g.fixtures = null; g.drawnAt = null; });
  saveToFirestore();
  renderAll();
}

// Game Management
function selectGame(id) {
  state.selectedGameId = id;
  saveToFirestore();
  renderAll();
}

function addGame() {
  const input = document.getElementById("newGameName");
  const name = input.value.trim();
  if (!name) { alert("Enter a game name."); return; }
  const newGame = {
    id: makeId("game"), name, format: "knockout",
    participantIds: [], seeds: [], groups: null, fixtures: null, drawnAt: null
  };
  state.games.push(newGame);
  state.selectedGameId = newGame.id;
  input.value = "";
  saveToFirestore();
  renderAll();
}

function deleteSelectedGame() {
  if (state.games.length <= 1) { alert("Need at least one game."); return; }
  const game = getSelectedGame();
  if (!confirm("Delete " + game.name + "?")) return;
  state.games = state.games.filter(g => g.id !== game.id);
  state.selectedGameId = state.games[0].id;
  saveToFirestore();
  renderAll();
}

function changeFormat(format) {
  const game = getSelectedGame();
  game.format = format;
  game.seeds = []; game.groups = null; game.fixtures = null; game.drawnAt = null;
  
  if (format === "groupStage" && !game.groups) {
    game.groups = [];
  }
  
  saveToFirestore();
  renderAll();
}

function toggleParticipant(orgId, checked) {
  const game = getSelectedGame();
  const selected = new Set(game.participantIds);
  if (checked) selected.add(orgId); else selected.delete(orgId);
  game.participantIds = state.organisations.filter(o => selected.has(o.id)).map(o => o.id);
  game.seeds = []; game.groups = null; game.fixtures = null; game.drawnAt = null;
  saveToFirestore();
  renderAll();
}

function selectAllParticipants() {
  const game = getSelectedGame();
  game.participantIds = state.organisations.map(o => o.id);
  game.seeds = []; game.groups = null; game.fixtures = null; game.drawnAt = null;
  saveToFirestore();
  renderAll();
}

function clearParticipants() {
  const game = getSelectedGame();
  game.participantIds = []; game.seeds = []; game.groups = null; game.fixtures = null; game.drawnAt = null;
  saveToFirestore();
  renderAll();
}

// Group Management
function addNewGroup() {
  const game = getSelectedGame();
  if (!game.groups) game.groups = [];
  
  const groupNumber = game.groups.length + 1;
  const groupName = "Group " + String.fromCharCode(64 + groupNumber);
  
  game.groups.push({
    name: groupName,
    teams: []
  });
  
  saveToFirestore();
  renderAll();
}

function deleteGroup(groupIndex) {
  const game = getSelectedGame();
  if (!game.groups) return;
  
  if (!confirm("Delete " + game.groups[groupIndex].name + "?")) return;
  
  game.groups.splice(groupIndex, 1);
  game.fixtures = null;
  game.drawnAt = null;
  
  saveToFirestore();
  renderAll();
}

function renameGroup(groupIndex, newName) {
  const game = getSelectedGame();
  if (!game.groups) return;
  
  game.groups[groupIndex].name = newName.trim() || game.groups[groupIndex].name;
  
  saveToFirestore();
  renderAll();
}

function assignTeamToGroup(orgId, groupIndex) {
  const game = getSelectedGame();
  if (!game.groups) return;
  
  game.groups.forEach(group => {
    group.teams = group.teams.filter(t => t.orgId !== orgId);
  });
  
  const org = state.organisations.find(o => o.id === orgId);
  if (org) {
    game.groups[groupIndex].teams.push({
      orgId: org.id,
      name: org.name
    });
  }
  
  game.fixtures = null;
  game.drawnAt = null;
  
  saveToFirestore();
  renderAll();
}

function removeTeamFromGroup(orgId, groupIndex) {
  const game = getSelectedGame();
  if (!game.groups) return;
  
  game.groups[groupIndex].teams = game.groups[groupIndex].teams.filter(t => t.orgId !== orgId);
  game.fixtures = null;
  game.drawnAt = null;
  
  saveToFirestore();
  renderAll();
}

function runRandomSeedDraw() {
  const game = getSelectedGame();
  
  if (game.format === "groupStage") {
    if (!game.groups || game.groups.length === 0) {
      alert("Please create groups and assign teams first.");
      return;
    }
    
    const allAssignedTeams = game.groups.flatMap(g => g.teams);
    if (allAssignedTeams.length < 2) {
      alert("Please assign at least 2 teams to groups.");
      return;
    }
    
    if (game.fixtures && !confirm("Regenerate fixtures?")) return;
    
    game.fixtures = generateFixturesFromGroups(game);
    game.drawnAt = new Date().toLocaleString();
    saveToFirestore();
    renderAll();
  } else {
    const participants = game.participantIds.map(id => state.organisations.find(o => o.id === id)).filter(Boolean);
    if (participants.length < 2) { alert("Select at least 2 organisations."); return; }
    if (game.seeds.length > 0 && !confirm("Redraw and replace?")) return;

    const shuffled = shuffleArray(participants);
    game.seeds = shuffled.map((org, i) => ({ seed: i + 1, orgId: org.id, name: org.name }));
    game.groups = null;
    game.fixtures = generateFixtures(game);
    game.drawnAt = new Date().toLocaleString();
    saveToFirestore();
    renderAll();
  }
}

// Results
function updateMatchResult(roundIndex, matchIndex, field, value) {
  const game = getSelectedGame();
  if (!game.fixtures) return;
  const match = game.fixtures.rounds[roundIndex].matches[matchIndex];
  if (!match.result) match.result = { scoreA: null, scoreB: null };
  match.result[field] = (value === "" || value === null) ? null : parseInt(value);

  if (game.fixtures.type === "knockout") recalculateKnockoutBracket(game);
  saveToFirestore();
  renderAll();
}

function recalculateKnockoutBracket(game) {
  for (let r = 1; r < game.fixtures.rounds.length; r++) {
    const prev = game.fixtures.rounds[r - 1];
    const curr = game.fixtures.rounds[r];
    for (let m = 0; m < curr.matches.length; m++) {
      curr.matches[m].teamA = getAdvancementSlot(prev.matches[m * 2]);
      curr.matches[m].teamB = getAdvancementSlot(prev.matches[m * 2 + 1]);
    }
  }
}

function getAdvancementSlot(match) {
  if (match.bye) {
    if (!match.teamA.bye) return match.teamA;
    if (!match.teamB.bye) return match.teamB;
  }
  if (!match.result || match.result.scoreA === null || match.result.scoreB === null) {
    return { name: "Winner " + match.label, seed: null, placeholder: true, bye: false };
  }
  if (match.result.scoreA > match.result.scoreB) return { ...match.teamA, advanced: true };
  if (match.result.scoreB > match.result.scoreA) return { ...match.teamB, advanced: true };
  return { name: "Draw (" + match.label + ")", seed: null, placeholder: true, bye: false };
}

function clearAllResults() {
  const game = getSelectedGame();
  if (!game.fixtures) return;
  if (!confirm("Clear all results for " + game.name + "?")) return;
  game.fixtures.rounds.forEach(r => r.matches.forEach(m => m.result = null));
  if (game.fixtures.type === "knockout") {
    for (let r = 1; r < game.fixtures.rounds.length; r++) {
      const prev = game.fixtures.rounds[r - 1];
      const curr = game.fixtures.rounds[r];
      for (let m = 0; m < curr.matches.length; m++) {
        curr.matches[m].teamA = { name: "Winner " + prev.matches[m * 2].label, seed: null, placeholder: true, bye: false };
        curr.matches[m].teamB = { name: "Winner " + prev.matches[m * 2 + 1].label, seed: null, placeholder: true, bye: false };
      }
    }
  }
  saveToFirestore();
  renderAll();
}

function calculateGroupStandings(game) {
  if (!game.groups) return [];
  const allStandings = [];
  game.groups.forEach(group => {
    const standings = {};
    group.teams.forEach(t => {
      standings[t.orgId] = { orgId: t.orgId, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    });
    game.fixtures.rounds.filter(r => r.groupName === group.name).forEach(r => {
      r.matches.forEach(m => {
        if (m.result && m.result.scoreA !== null && m.result.scoreB !== null) {
          const a = standings[m.teamA.orgId];
          const b = standings[m.teamB.orgId];
          if (a && b) {
            a.played++; b.played++;
            a.goalsFor += m.result.scoreA; a.goalsAgainst += m.result.scoreB;
            b.goalsFor += m.result.scoreB; b.goalsAgainst += m.result.scoreA;
            if (m.result.scoreA > m.result.scoreB) { a.won++; a.points += 3; b.lost++; }
            else if (m.result.scoreB > m.result.scoreA) { b.won++; b.points += 3; a.lost++; }
            else { a.drawn++; b.drawn++; a.points += 1; b.points += 1; }
          }
        }
      });
    });
    const sorted = Object.values(standings).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
    allStandings.push({ groupName: group.name, standings: sorted });
  });
  return allStandings;
}

function calculateRoundRobinStandings(game) {
  const standings = {};
  game.seeds.forEach(s => {
    standings[s.orgId] = { orgId: s.orgId, name: s.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
  });
  game.fixtures.rounds.forEach(r => {
    r.matches.forEach(m => {
      if (m.result && m.result.scoreA !== null && m.result.scoreB !== null) {
        const a = standings[m.teamA.orgId];
        const b = standings[m.teamB.orgId];
        if (a && b) {
          a.played++; b.played++;
          a.goalsFor += m.result.scoreA; a.goalsAgainst += m.result.scoreB;
          b.goalsFor += m.result.scoreB; b.goalsAgainst += m.result.scoreA;
          if (m.result.scoreA > m.result.scoreB) { a.won++; a.points += 3; b.lost++; }
          else if (m.result.scoreB > m.result.scoreA) { b.won++; b.points += 3; a.lost++; }
          else { a.drawn++; b.drawn++; a.points += 1; b.points += 1; }
        }
      }
    });
  });
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

function copyFixtures() {
  const game = getSelectedGame();
  if (!game.fixtures) { alert("No fixtures yet."); return; }
  const lines = [state.tournamentName, "Game: " + game.name, ""];
  lines.push("SEEDS");
  game.seeds.forEach(s => lines.push("#" + s.seed + " " + s.name));
  lines.push("");
  lines.push("FIXTURES");
  game.fixtures.rounds.forEach(r => {
    lines.push("");
    lines.push(r.name);
    r.matches.forEach(m => {
      const a = m.teamA.bye ? "BYE" : m.teamA.seed ? "#" + m.teamA.seed + " " + m.teamA.name : m.teamA.name;
      const b = m.teamB.bye ? "BYE" : m.teamB.seed ? "#" + m.teamB.seed + " " + m.teamB.name : m.teamB.name;
      let res = "";
      if (m.result && m.result.scoreA !== null && m.result.scoreB !== null) {
        res = " [" + m.result.scoreA + " - " + m.result.scoreB + "]";
      }
      lines.push(m.label + ": " + a + " vs " + b + res);
    });
  });
  navigator.clipboard.writeText(lines.join("\n"))
    .then(() => alert("Copied."))
    .catch(() => alert("Copy failed."));
}

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "Enter" && document.activeElement.id === "singleOrganisation") addSingleOrganisation();
  if (e.key === "Enter" && document.activeElement.id === "newGameName") addGame();
});

updateModeUI();
initTournament();
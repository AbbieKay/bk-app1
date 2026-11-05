function renderGameDetailView() {
  const game = getSelectedGame();
  
  if (isAdmin) {
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("tournamentNameInput").value = state.tournamentName;
    document.getElementById("adminCodeInput").value = state.adminCode;
    renderGames();
    renderOrganisations();
    renderParticipants();
    document.getElementById("selectedGameTitle").textContent = game.name;
    document.getElementById("formatSelect").value = game.format;

    const groupSection = document.getElementById("groupAssignmentSection");
    if (game.format === "groupStage") {
      groupSection.classList.remove("hidden");
      renderGroupAssignment();
    } else {
      groupSection.classList.add("hidden");
    }

    const status = game.participantIds.length + " selected. " +
      (game.seeds.length > 0 ? "Drawn." : "No draw.") +
      (game.drawnAt ? " Last: " + game.drawnAt : "");
    document.getElementById("gameStatus").textContent = status;
  } else {
    document.getElementById("adminPanel").classList.add("hidden");
  }

  renderSeeds();
  renderFixtures();
  renderStandings();
}

function renderGames() {
  const select = document.getElementById("gameSelect");
  select.innerHTML = state.games.map(g => '<option value="' + g.id + '">' + esc(g.name) + "</option>").join("");
  select.value = state.selectedGameId;
}

function renderOrganisations() {
  const list = document.getElementById("organisationList");
  document.getElementById("organisationCount").textContent = state.organisations.length;
  if (state.organisations.length === 0) {
    list.innerHTML = '<p class="text-sm text-gray-500 text-center py-6">No organisations yet.</p>';
    return;
  }
  list.innerHTML = state.organisations.map(o => `
    <div class="flex items-center justify-between gap-2 bg-gray-800 border border-gray-700 rounded-lg p-2">
      <span class="text-sm">${esc(o.name)}</span>
      <button onclick="removeOrganisation('${o.id}')" class="text-red-400 hover:text-red-300 text-xs px-2">✕</button>
    </div>
  `).join("");
}

function renderParticipants() {
  const game = getSelectedGame();
  const container = document.getElementById("participantsList");
  document.getElementById("participantCount").textContent = game.participantIds.length;
  if (state.organisations.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 col-span-full py-6 text-center">Upload organisations first.</p>';
    return;
  }
  container.innerHTML = state.organisations.map(o => {
    const checked = game.participantIds.includes(o.id) ? "checked" : "";
    return `
      <label class="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer">
        <input type="checkbox" ${checked} onchange="toggleParticipant('${o.id}', this.checked)" class="w-4 h-4" />
        <span class="text-sm">${esc(o.name)}</span>
      </label>
    `;
  }).join("");
}

function renderGroupAssignment() {
  const game = getSelectedGame();
  const area = document.getElementById("groupAssignmentArea");

  if (!game.groups || game.groups.length === 0) {
    area.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">No groups created yet. Click "+ Add Group" to start.</p>';
    return;
  }

  const assignedOrgIds = new Set(game.groups.flatMap(g => g.teams.map(t => t.orgId)));
  const unassignedTeams = game.participantIds
    .filter(id => !assignedOrgIds.has(id))
    .map(id => state.organisations.find(o => o.id === id))
    .filter(Boolean);

  let html = '';

  html += `
    <div class="bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl p-4 group-card">
      <h3 class="font-bold text-amber-400 mb-3">Unassigned Teams (${unassignedTeams.length})</h3>
      <div class="min-h-[100px]">
  `;

  if (unassignedTeams.length === 0) {
    html += '<p class="text-xs text-gray-500 text-center py-4">All teams assigned</p>';
  } else {
    unassignedTeams.forEach(org => {
      html += `
        <div class="team-chip">
          <span>${esc(org.name)}</span>
          <div class="flex gap-1">
      `;
      game.groups.forEach((group, gi) => {
        html += `<button onclick="assignTeamToGroup('${org.id}', ${gi})" class="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded" title="Add to ${esc(group.name)}">→${esc(group.name.replace('Group ', ''))}</button>`;
      });
      html += `</div></div>`;
    });
  }

  html += `</div></div>`;

  game.groups.forEach((group, groupIndex) => {
    html += `
      <div class="bg-gray-800 border border-gray-700 rounded-xl p-4 group-card">
        <div class="flex items-center justify-between mb-3">
          <input type="text" value="${esc(group.name)}" onchange="renameGroup(${groupIndex}, this.value)"
            class="bg-transparent font-bold text-purple-400 border-b border-transparent hover:border-gray-600 focus:border-purple-500 focus:outline-none text-lg" />
          <button onclick="deleteGroup(${groupIndex})" class="text-red-400 hover:text-red-300 text-xs">✕</button>
        </div>
        <div class="min-h-[100px]">
    `;

    if (group.teams.length === 0) {
      html += '<p class="text-xs text-gray-500 text-center py-4">No teams assigned</p>';
    } else {
      group.teams.forEach(team => {
        html += `
          <div class="team-chip">
            <span>${esc(team.name)}</span>
            <button onclick="removeTeamFromGroup('${team.orgId}', ${groupIndex})" class="text-red-400 hover:text-red-300 text-xs">✕</button>
          </div>
        `;
      });
    }

    html += `</div></div>`;
  });

  area.innerHTML = html;
}

function renderSeeds() {
  const game = getSelectedGame();
  const area = document.getElementById("seedsArea");
  if (!game.seeds || game.seeds.length === 0) {
    area.innerHTML = '<div class="border-2 border-dashed border-gray-800 rounded-xl p-8 text-center text-gray-500">No seeds yet.</div>';
    return;
  }

  if (game.format === "groupStage" && game.groups) {
    let html = '';
    game.groups.forEach(group => {
      html += `
        <div class="mb-4">
          <h3 class="text-lg font-bold text-purple-400 mb-2">${esc(group.name)}</h3>
          <div class="overflow-hidden rounded-xl border border-gray-800">
            <table class="w-full text-sm">
              <tbody>
                ${group.teams.map(t => {
                  const seed = game.seeds.find(s => s.orgId === t.orgId);
                  return `
                    <tr class="border-t border-gray-800">
                      <td class="p-3 font-black text-green-400">#${seed ? seed.seed : '?'}</td>
                      <td class="p-3">${esc(t.name)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
    area.innerHTML = html;
  } else {
    area.innerHTML = `
      <div class="overflow-hidden rounded-xl border border-gray-800">
        <table class="w-full text-sm">
          <thead class="bg-gray-800 text-gray-300">
            <tr><th class="text-left p-3 w-20">Seed</th><th class="text-left p-3">Organisation</th></tr>
          </thead>
          <tbody>
            ${game.seeds.map(s => `
              <tr class="border-t border-gray-800">
                <td class="p-3 font-black text-green-400">#${s.seed}</td>
                <td class="p-3">${esc(s.name)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }
}

function renderTeamSlot(slot) {
  if (!slot || slot.bye) return '<span class="italic text-gray-500">BYE</span>';
  if (slot.placeholder) return '<span class="italic text-amber-300">' + esc(slot.name) + "</span>";
  return '<span class="font-bold text-white">#' + slot.seed + " " + esc(slot.name) + "</span>";
}

function renderFixtures() {
  const game = getSelectedGame();
  const area = document.getElementById("fixturesArea");
  if (!game.fixtures) {
    area.innerHTML = '<div class="border-2 border-dashed border-gray-800 rounded-xl p-8 text-center text-gray-500">Fixtures will appear after the draw.</div>';
    return;
  }

  const formatName = game.fixtures.type === "knockout" ? "Knockout" : game.fixtures.type === "groupStage" ? "Group Stage" : "Round Robin";
  let html = `
    <div class="mb-5 bg-gray-800 border border-gray-700 rounded-xl p-4">
      <p class="text-sm text-gray-400">Format</p>
      <p class="font-bold text-white">${formatName}</p>
    </div>
  `;

  game.fixtures.rounds.forEach((round, ri) => {
    html += `<div class="mb-6"><h3 class="text-lg font-black text-purple-400 mb-3">${esc(round.name)}</h3><div class="space-y-3">`;

    round.matches.forEach((match, mi) => {
      const scoreA = match.result && match.result.scoreA !== null ? match.result.scoreA : "";
      const scoreB = match.result && match.result.scoreB !== null ? match.result.scoreB : "";

      let aClass = "bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center justify-between gap-2";
      let bClass = "bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center justify-between gap-2";

      if (match.result && match.result.scoreA !== null && match.result.scoreB !== null) {
        if (match.result.scoreA > match.result.scoreB) { aClass += " winner-row"; bClass += " loser-row"; }
        else if (match.result.scoreB > match.result.scoreA) { bClass += " winner-row"; aClass += " loser-row"; }
      }

      const scoreInputA = isAdmin && !match.bye
        ? `<input type="number" min="0" value="${scoreA}" onchange="updateMatchResult(${ri}, ${mi}, 'scoreA', this.value)" class="score-input" />`
        : (scoreA !== "" ? `<span class="font-black text-xl text-white">${scoreA}</span>` : "");
      const scoreInputB = isAdmin && !match.bye
        ? `<input type="number" min="0" value="${scoreB}" onchange="updateMatchResult(${ri}, ${mi}, 'scoreB', this.value)" class="score-input" />`
        : (scoreB !== "" ? `<span class="font-black text-xl text-white">${scoreB}</span>` : "");

      html += `
        <div class="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <span class="text-xs bg-gray-900 border border-gray-700 px-2 py-1 rounded-full text-gray-300">${esc(match.label)}</span>
            ${match.bye ? '<span class="text-xs text-yellow-400">BYE</span>' : ''}
          </div>
          <div class="space-y-2">
            <div class="${aClass}">
              <span class="team-name text-sm">${renderTeamSlot(match.teamA)}</span>
              ${scoreInputA}
            </div>
            <div class="text-center text-xs text-gray-500 font-bold">VS</div>
            <div class="${bClass}">
              <span class="team-name text-sm">${renderTeamSlot(match.teamB)}</span>
              ${scoreInputB}
            </div>
          </div>
          ${match.note ? '<p class="text-xs text-yellow-400 mt-3">' + esc(match.note) + "</p>" : ""}
        </div>
      `;
    });

    html += `</div></div>`;
  });

  area.innerHTML = html;
}

function renderStandings() {
  const game = getSelectedGame();
  const section = document.getElementById("standingsSection");
  const area = document.getElementById("standingsArea");

  if (!game.fixtures) {
    section.classList.add("hidden");
    return;
  }

  if (game.fixtures.type === "groupStage") {
    section.classList.remove("hidden");
    const allStandings = calculateGroupStandings(game);
    
    if (allStandings.length === 0) {
      area.innerHTML = '<p class="text-gray-500 text-center py-6">No standings yet.</p>';
      return;
    }

    let html = '';
    allStandings.forEach(groupData => {
      html += `
        <div class="mb-6">
          <h3 class="text-lg font-bold text-purple-400 mb-3">${esc(groupData.groupName)} Standings</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-800 text-gray-300">
                <tr>
                  <th class="p-3 text-left">#</th>
                  <th class="p-3 text-left">Organisation</th>
                  <th class="p-3 text-center">P</th>
                  <th class="p-3 text-center">W</th>
                  <th class="p-3 text-center">D</th>
                  <th class="p-3 text-center">L</th>
                  <th class="p-3 text-center">GF</th>
                  <th class="p-3 text-center">GA</th>
                  <th class="p-3 text-center">GD</th>
                  <th class="p-3 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
      `;

      groupData.standings.forEach((t, i) => {
        const gd = t.goalsFor - t.goalsAgainst;
        const posClass = i === 0 ? "text-amber-400 font-black" : "text-gray-300";
        html += `
          <tr class="border-t border-gray-800">
            <td class="p-3 ${posClass}">${i + 1}</td>
            <td class="p-3 font-semibold">${esc(t.name)}</td>
            <td class="p-3 text-center">${t.played}</td>
            <td class="p-3 text-center text-green-400">${t.won}</td>
            <td class="p-3 text-center text-gray-400">${t.drawn}</td>
            <td class="p-3 text-center text-red-400">${t.lost}</td>
            <td class="p-3 text-center">${t.goalsFor}</td>
            <td class="p-3 text-center">${t.goalsAgainst}</td>
            <td class="p-3 text-center">${gd > 0 ? "+" + gd : gd}</td>
            <td class="p-3 text-center font-black text-white">${t.points}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div></div>`;
    });

    area.innerHTML = html;
  } else if (game.fixtures.type === "roundRobin") {
    section.classList.remove("hidden");
    const standings = calculateRoundRobinStandings(game);
    
    if (standings.length === 0) {
      area.innerHTML = '<p class="text-gray-500 text-center py-6">No standings yet.</p>';
      return;
    }

    let html = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-800 text-gray-300">
            <tr>
              <th class="p-3 text-left">#</th>
              <th class="p-3 text-left">Organisation</th>
              <th class="p-3 text-center">P</th>
              <th class="p-3 text-center">W</th>
              <th class="p-3 text-center">D</th>
              <th class="p-3 text-center">L</th>
              <th class="p-3 text-center">GF</th>
              <th class="p-3 text-center">GA</th>
              <th class="p-3 text-center">GD</th>
              <th class="p-3 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
    `;

    standings.forEach((t, i) => {
      const gd = t.goalsFor - t.goalsAgainst;
      const posClass = i === 0 ? "text-amber-400 font-black" : "text-gray-300";
      html += `
        <tr class="border-t border-gray-800">
          <td class="p-3 ${posClass}">${i + 1}</td>
          <td class="p-3 font-semibold">${esc(t.name)}</td>
          <td class="p-3 text-center">${t.played}</td>
          <td class="p-3 text-center text-green-400">${t.won}</td>
          <td class="p-3 text-center text-gray-400">${t.drawn}</td>
          <td class="p-3 text-center text-red-400">${t.lost}</td>
          <td class="p-3 text-center">${t.goalsFor}</td>
          <td class="p-3 text-center">${t.goalsAgainst}</td>
          <td class="p-3 text-center">${gd > 0 ? "+" + gd : gd}</td>
          <td class="p-3 text-center font-black text-white">${t.points}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    area.innerHTML = html;
  } else {
    section.classList.add("hidden");
  }
}